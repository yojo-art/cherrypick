/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { Client as OpenSearch } from '@opensearch-project/opensearch';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { MiNote } from '@/models/Note.js';
import { MiUser } from '@/models/_.js';
import type { NotesRepository } from '@/models/_.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { CacheService } from '@/core/CacheService.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { isQuote, isRenote } from '@/misc/is-renote.js';
import { isReply } from '@/misc/is-reply.js';
import { DriveService } from './DriveService.js';
import type Logger from '@/logger.js';

type OpenSearchHit = {
	_index: string
	_id: string
	_score?: number
	_source:{
    id: string,
    userId: string
    visibility: string
    visibleUserIds?: string[]
		referenceUserId?: string
	}
}
type K = string;
type V = string | number | boolean;
type Q =
	{ op: '=', k: K, v: V } |
	{ op: '!=', k: K, v: V } |
	{ op: '>', k: K, v: number } |
	{ op: '<', k: K, v: number } |
	{ op: '>=', k: K, v: number } |
	{ op: '<=', k: K, v: number } |
	{ op: 'is null', k: K} |
	{ op: 'is not null', k: K} |
	{ op: 'and', qs: Q[] } |
	{ op: 'or', qs: Q[] } |
	{ op: 'not', q: Q };

function compileValue(value: V): string {
	if (typeof value === 'string' ) {
		return `'${value}'`;
	} else if (typeof value === 'number' ) {
		return value.toString();
	} else if (typeof value === 'boolean' ) {
		return value.toString();
	}
	throw new Error('unrecognized value');
}

function compileQuery(q: Q): string {
	switch (q.op) {
		case '=': return `(${q.k} = ${compileValue(q.v)})`;
		case '!=': return `(${q.k} != ${compileValue(q.v)})`;
		case '>': return `(${q.k} > ${compileValue(q.v)})`;
		case '<': return `(${q.k} < ${compileValue(q.v)})`;
		case '>=': return `(${q.k} >= ${compileValue(q.v)})`;
		case '<=': return `(${q.k} <= ${compileValue(q.v)})`;
		case 'and': return q.qs.length === 0 ? '' : `(${ q.qs.map(_q => compileQuery(_q)).join(' AND ') })`;
		case 'or': return q.qs.length === 0 ? '' : `(${ q.qs.map(_q => compileQuery(_q)).join(' OR ')})`;
		case 'is null': return `(${q.k} IS NULL)`;
		case 'is not null': return `(${q.k} IS NOT NULL)`;
		case 'not': return `(NOT ${compileQuery(q.q)})`;
		default: throw new Error('unrecognized query operator');
	}
}

const retryLimit = 2;

@Injectable()
export class AdvancedSearchService {
	private opensearchNoteIndex: string | null = null;
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.opensearch)
		private opensearch: OpenSearch | null,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private cacheService: CacheService,
		private queryService: QueryService,
		private idService: IdService,
		private loggerService: LoggerService,
		private driveService: DriveService,
	) {
		this.logger = this.loggerService.getLogger('search');
		if (opensearch && config.opensearch && config.opensearch.index) {
			const indexname = `${config.opensearch.index}---notes`;
			this.opensearchNoteIndex = indexname;
			this.opensearch?.indices.exists({
				index: indexname,
			}).then((indexExists) => {
				if (!indexExists) [
					this.opensearch?.indices.create({
						index: indexname,
						body: {
							mappings: {
								properties: {
									text: {
										type: 'text',
										analyzer: 'sudachi_analyzer' },
									cw: {
										type: 'text',
										analyzer: 'sudachi_analyzer' },
									userId: { type: 'keyword' },
									userHost: { type: 'keyword' },
									createdAt: { type: 'date' },
									tags: { type: 'keyword' },
									fileIds: { type: 'keyword' },
									visibility: { type: 'keyword' },
									visibleUserIds: { type: 'keyword' },
									isReply: { type: 'boolean' },
									isQuote: { type: 'boolean' },
									referenceUserId: { type: 'keyword' },
									sensitiveFileCount: { type: 'byte' },
									nonSensitiveFileCount: { type: 'byte' },
								},
							},
							settings: {
								index: {
									analysis: {
										analyzer: {
											sudachi_analyzer: {
												filter: [
													'sudachi_baseform',
													'sudachi_readingform',
													'sudachi_normalizedform',
												],
												tokenizer: 'sudachi_a_tokenizer',
												type: 'custom',
											},
										},
										tokenizer: {
											sudachi_a_tokenizer: {
												type: 'sudachi_tokenizer',
												additional_settings: '{"systemDict":"system_full.dic"}',
												split_mode: 'A',
												discard_punctuation: true,
											},
										},
									},
								},
							},
						},
					}).catch((error) => {
						this.logger.error(error);
					}),
				];
			}).catch((error) => {
				this.logger.error(error);
			});
		} else {
			this.logger.info('OpenSearch is not available');
			this.opensearchNoteIndex = null;
		}
	}

	@bindThis
	public async indexNote(note: MiNote): Promise<void> {
		if (note.text == null && note.cw == null) return;

		if (this.opensearch) {
			if (await this.redisClient.get('indexDeleted') !== null) {
				return;
			}
			const IsReply = isReply(note);
			const IsQuote = isRenote(note) && isQuote(note);
			const sensitiveCount = await this.driveService.getSensitiveFileCount(note.fileIds);
			const nonSensitiveCount = note.fileIds.length - sensitiveCount;

			const body = {
				text: note.text,
				cw: note.cw,
				userId: note.userId,
				userHost: note.userHost,
				createdAt: this.idService.parse(note.id).date.getTime(),
				tags: note.tags,
				fileIds: note.fileIds,
				visibility: note.visibility,
				visibleUserIds: note.visibleUserIds,
				isReply: IsReply,
				isQuote: IsQuote,
				referenceUserId: IsReply ? note.replyUserId : IsQuote ? note.renoteUserId : null,
				sensitiveFileCount: sensitiveCount,
				nonSensitiveFileCount: nonSensitiveCount,
			};
			await this.opensearch.index({
				index: this.opensearchNoteIndex as string,
				id: note.id,
				body: body,
			}).catch((error) => {
				this.logger.error(error);
			});
		}
	}

	@bindThis
	public async recreateIndex(): Promise<void> {
		if (this.opensearch) {
			if (await this.redisClient.get('indexDeleted') !== null) {
				return;
			}

			await this.redisClient.set('indexDeleted', 'deleted', 'EX', 300);
			await this.opensearch.indices.delete({
				index: this.opensearchNoteIndex as string }).catch((error) => {
				this.logger.error(error);
				return;
			});

			await this.opensearch.indices.create({
				index: this.opensearchNoteIndex as string,
				body: {
					mappings: {
						properties: {
							text: {
								type: 'text',
								analyzer: 'sudachi_analyzer' },
							cw: {
								type: 'text',
								analyzer: 'sudachi_analyzer' },
							userId: { type: 'keyword' },
							userHost: { type: 'keyword' },
							createdAt: { type: 'date' },
							tags: { type: 'keyword' },
							fileIds: { type: 'keyword' },
							visibility: { type: 'keyword' },
							visibleUserIds: { type: 'keyword' },
							isReply: { type: 'boolean' },
							isQuote: { type: 'boolean' },
							referenceUserId: { type: 'keyword' },
							sensitiveFileCount: { type: 'byte' },
							nonSensitiveFileCount: { type: 'byte' },
						},
					},
					settings: {
						index: {
							analysis: {
								analyzer: {
									sudachi_analyzer: {
										filter: [
											'sudachi_baseform',
											'sudachi_readingform',
											'sudachi_normalizedform',
										],
										tokenizer: 'sudachi_a_tokenizer',
										type: 'custom',
									},
								},
								tokenizer: {
									sudachi_a_tokenizer: {
										type: 'sudachi_tokenizer',
										additional_settings: '{"systemDict":"system_full.dic"}',
										split_mode: 'A',
										discard_punctuation: true,
									},
								},
							},
						},
					},
				},
			}).catch((error) => {
				this.logger.error(error);
				return;
			});

			await this.redisClient.del('indexDeleted');
			this.logger.info('reIndexing.');
			this.fullIndexNote().catch((error) => {
				this.logger.error(error);
				return;
			});
		}
	}

	@bindThis
	public async fullIndexNote(): Promise<void> {
		if (!this.opensearch) return;

		const notesCount = await this.notesRepository.createQueryBuilder('note').getCount();
		const limit = 100;
		let latestid = '';
		for (let index = 0; index < notesCount; index += limit) {
			this.logger.info('indexing' + index + '/' + notesCount);

			const notes = await this.notesRepository
				.createQueryBuilder('note')
				.where('note.id > :latestid', { latestid })
				.orderBy('note.id', 'ASC')
				.limit(limit)
				.getMany();
			notes.forEach(note => {
				this.indexNote(note);
				latestid = note.id;
			});
		}
		this.logger.info('All notes has been indexed.');
	}

	@bindThis
	public async unindexNote(note: MiNote): Promise<void> {
		if (this.opensearch) {
			if (await this.redisClient.get('indexDeleted') !== null) {
				return;
			}
			this.opensearch.delete({
				index: this.opensearchNoteIndex as string,
				id: note.id,
			}).catch((error) => {
				console.error(error);
			});
		}
	}

	@bindThis
	public async searchNote(q: string, me: MiUser | null, opts: {
		userId?: MiNote['userId'] | null;
		host?: string | null;
		origin?: string | null;
		fileOption?: string | null;
		visibility?: MiNote['visibility'] | null;
		excludeCW?: boolean;
		excludeReply?: boolean;
		excludeQuote?: boolean;
		sensitiveFilter?: string | null;
		offset?: number | null;
	}, pagination: {
		untilId?: MiNote['id'];
		sinceId?: MiNote['id'];
		limit?: number;
	}): Promise<MiNote[]> {
		if (this.opensearch) {
			const osFilter: any = {
				bool: {
					must: [],
					must_not: [],
				},
			};

			if (pagination.untilId) osFilter.bool.must.push({ range: { createdAt: { lt: this.idService.parse(pagination.untilId).date.getTime() } } });
			if (pagination.sinceId) osFilter.bool.must.push({ range: { createdAt: { gt: this.idService.parse(pagination.sinceId).date.getTime() } } });
			if (opts.userId) osFilter.bool.must.push({ term: { userId: opts.userId } });
			if (opts.host) {
				if (opts.host === '.') {
					osFilter.bool.must_not.push({ exists: { field: 'userHost' } });
				} else {
					osFilter.bool.must.push({ term: { userHost: opts.host } });
				}
			}
			if (opts.origin) {
				if (opts.origin === 'local') {
					osFilter.bool.must_not.push({ exists: { field: 'userHost' } });
				} else if (opts.origin === 'remote') {
					osFilter.bool.must.push({ exists: { field: 'userHost' } } );
				}
			}
			if (opts.excludeReply) osFilter.bool.must_not.push({ exists: { isReply: false } });
			if (opts.excludeCW) osFilter.bool.must_not.push({ exists: { field: 'cw' } });
			if (opts.excludeQuote) osFilter.bool.must.push({ term: { isQuote: false } });
			if (opts.fileOption) {
				if (opts.fileOption === 'file-only') {
					osFilter.bool.must.push({ exists: { field: 'fileIds' } });
				} else if (opts.fileOption === 'no-file') {
					osFilter.bool.must_not.push({ exists: { field: 'fileIds' } });
				}
			}
			if (opts.sensitiveFilter) {
				if (opts.sensitiveFilter === 'includeSensitive') {
					osFilter.bool.must.push({ range: { sensitiveFileCount: { gte: 1 } } });
				} else if (opts.sensitiveFilter === 'withOutSensitive') {
					osFilter.bool.must.push({ term: { sensitiveFileCount: 0 } } );
				} else if (opts.sensitiveFilter === 'sensitiveOnly') {
					osFilter.bool.must.push({ term: { nonSensitiveFileCount: 0 } } );
					osFilter.bool.must.push({ range: { sensitiveFileCount: { gte: 1 } } });
				}
			}

			if (q !== '') {
				if (opts.excludeCW) {
					osFilter.bool.must.push({
						bool: {
							should: [
								{ wildcard: { 'text': { value: q } } },
								{ simple_query_string: { fields: ['text'], 'query': q, default_operator: 'and' } },
							],
							minimum_should_match: 1,
						},
					});
				} else {
					osFilter.bool.must.push({
						bool: {
							should: [
								{ wildcard: { 'text': { value: q } } },
								{ wildcard: { 'cw': { value: q } } },
								{ simple_query_string: { fields: ['text', 'cw'], 'query': q, default_operator: 'and' } },
							],
							minimum_should_match: 1,
						},
					});
				}
			}

			if (me) {
				/*ブロックされている or ミュートしているフィルタ*/
				const [
					userIdsWhoMeMuting,
					userIdsWhoMeBlockingMe,
				] = await Promise.all([
					this.cacheService.userMutingsCache.fetch(me.id),
					this.cacheService.userBlockedCache.fetch(me.id),
				]);
				const Filter = Array.from(userIdsWhoMeMuting).concat(Array.from(userIdsWhoMeBlockingMe));
				const FollowingsCache = await this.cacheService.userFollowingsCache.fetch(me.id);
				const Followings = Object.keys(FollowingsCache);

				let Option: any;

				if (opts.offset && 0 < opts.offset) {
					Option = {
						index: this.opensearchNoteIndex as string,
						body: {
							query: osFilter,
							sort: [{ createdAt: { order: 'desc' } }],
						},
						_source: ['id', 'userId', 'visibility', 'visibleUserIds', 'referenceUserId'],
						size: pagination.limit,
						from: opts.offset,
					};
				} else {
					Option = {
						index: this.opensearchNoteIndex as string,
						body: {
							query: osFilter,
							sort: [{ createdAt: { order: 'desc' } }],
						},
						_source: ['id', 'userId', 'visibility', 'visibleUserIds', 'referenceUserId'],
						size: pagination.limit,
					};
				}

				const Result = await this.search(Option, pagination.untilId ? 1 : 0, Filter, Followings, me.id);
				if (Result.length === 0) {
					return [];
				}
				const noteIds = Result.sort((a, b) => a._id > b._id ? -1 : 1).map((hit: any) => hit._id);
				return (await this.notesRepository.findBy({
					id: In(noteIds),
				})).sort((a, b) => a.id > b.id ? -1 : 1);
			} else {
				//meがないなら公開範囲が限られたものを探さない
				osFilter.bool.must.push({
					bool: {
						should: [
							{ term: { visibility: 'public' } },
							{ term: { visibility: 'home' } },
						],
						minimum_should_match: 1,
					},
				});

				let Option: any;
				if (opts.offset && 0 < opts.offset) {
					Option = {
						index: this.opensearchNoteIndex as string,
						body: {
							query: osFilter,
							sort: [{ createdAt: { order: 'desc' } }],
						},
						_source: ['id'],
						size: pagination.limit,
						from: opts.offset,
					};
				} else {
					Option = {
						index: this.opensearchNoteIndex as string,
						body: {
							query: osFilter,
							sort: [{ createdAt: { order: 'desc' } }],
						},
						_source: ['id'],
						size: pagination.limit,
					};
				}

				const Result = await this.opensearch.search(Option);

				if (Result.body.hits.hits.length === 0) {
					return [];
				}
				const noteIds = Result.body.hits.hits.map((hit: any) => hit._id);
				return (await this.notesRepository.findBy({
					id: In(noteIds),
				})).sort((a, b) => a.id > b.id ? -1 : 1);
			}
		} else {
			const query = this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), pagination.sinceId, pagination.untilId);

			if (opts.userId) {
				query.andWhere('note.userId = :userId', { userId: opts.userId });
			}

			if (opts.origin === 'local') {
				query.andWhere('note.userHost IS NULL');
			} else if (opts.origin === 'remote') {
				query.andWhere('note.userHost IS NOT NULL');
			}

			if (this.config.pgroonga) {
				query.andWhere('note.text &@~ :q', { q: `%${sqlLikeEscape(q)}%` });
			} else {
				query.andWhere('note.text ILIKE :q', { q: `%${sqlLikeEscape(q)}%` });
			}

			query
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			if (opts.host) {
				if (opts.host === '.') {
					query.andWhere('note.userHost IS NULL');
				} else {
					query.andWhere('note.userHost = :host', { host: opts.host });
				}
			}

			if (opts.visibility) {
				if (opts.visibility === 'home') {
					query.andWhere('(note.visibility = \'home\')');
				} else if (opts.visibility === 'followers') {
					query.andWhere('(note.visibility = \'followers\')');
				} else if (opts.visibility === 'public') {
					query.andWhere('(note.visibility === \'public\')');
				}
			}

			if (opts.excludeCW) {
				query.andWhere('note.cw IS NULL');
			}

			if (opts.excludeReply) {
				query.andWhere('note.replyId IS NULL');
			}

			if (opts.fileOption) {
				if (opts.fileOption === 'file-only') {
					query.andWhere('note.fileIds != \'{}\'');
				} else if (opts.fileOption === 'no-file') {
					query.andWhere('note.fileIds = :fIds', { fIds: '{}' });
				}
			}

			this.queryService.generateVisibilityQuery(query, me);
			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);

			return await query.limit(pagination.limit).getMany();
		}
	}

	@bindThis
	public async search(
		OpenSearchOption: any,
		untilAvail: number,
		Filter: string[],
		followings: string[],
		meUserId: string,
	): Promise<any[]> {
		if (!this.opensearch) throw new Error();
		let res = await this.opensearch.search(OpenSearchOption);
		let notes = res.body.hits.hits as OpenSearchHit[];

		if (!notes || notes.length === 0) return [];
		const FilterdNotes = notes.filter( Note => {//ミュートしてるかブロックされてるので見れない
			if (Filter.includes(Note._source.userId) ) return false;
			if (Note._source.referenceUserId) {
				if (Filter.includes(Note._source.referenceUserId)) return false;
			}

			if (['public', 'home'].includes(Note._source.visibility)) return true;//誰でも見れる

			if (Note._source.visibility === 'followers') { //鍵だけどフォローしてるか自分
				if (Note._source.userId === meUserId || followings.includes(Note._source.userId)) return true;
			}

			if (Note._source.visibility === 'specified') {
				if (Note._source.userId === meUserId) return true;//自分の投稿したダイレクトか自分が宛先に含まれている
				if (Note._source.visibleUserIds) {
					if (Note._source.visibleUserIds.includes(meUserId)) return true;
				}
			}
			return false;
		});
		let retry = false;

		//フィルタされたノートが1件以上、最初のヒット件数が指定された数未満ではない
		if (0 < (notes.length - FilterdNotes.length) && !(notes.length < OpenSearchOption.size)) {
			retry = true;
			if (untilAvail === 1) {
				OpenSearchOption.body.query.bool.must[0] = { range: { createdAt: { lt: this.idService.parse(notes[notes.length - 1 ]._id).date.getTime() } } };
			} else {
				OpenSearchOption.body.query.bool.must.push({ range: { createdAt: { lt: this.idService.parse(notes[notes.length - 1 ]._id).date.getTime() } } });
				untilAvail = 0;
			}
		}

		if (retry) {
			for (let i = 0; i < retryLimit; i++) {
				res = await this.opensearch.search(OpenSearchOption);
				notes = res.body.hits.hits as OpenSearchHit[];

				if (!notes || notes.length === 0) break;//これ以上探してもない

				const Filterd = notes.filter( Note => {//ミュートしてるかブロックされてるので見れない
					if (Filter.includes(Note._source.userId) ) return false;
					if (Note._source.referenceUserId) {
						if (Filter.includes(Note._source.referenceUserId)) return false;
					}

					if (['public', 'home'].includes(Note._source.visibility)) return true;//誰でも見れる

					if (Note._source.visibility === 'followers') { //鍵だけどフォローしてるか自分
						if (Note._source.userId === meUserId || followings.includes(Note._source.userId)) return true;
					}

					if (Note._source.visibility === 'specified') {
						if (Note._source.userId === meUserId) return true;//自分の投稿したダイレクトか自分が宛先に含まれている
						if (Note._source.visibleUserIds) {
							if (Note._source.visibleUserIds.includes(meUserId)) return true;
						}
					}
					return false;
				});

				for (let i = 0; i < notes.length - FilterdNotes.length && i < Filterd.length; i++) {
					FilterdNotes.push(Filterd[i]);
				}

				if (OpenSearchOption.size === FilterdNotes.length) {
					break;
				}

				//until指定
				if (untilAvail === 1) {
					OpenSearchOption.body.query.bool.must[0] = { range: { createdAt: { lt: this.idService.parse(notes[notes.length - 1 ]._id).date.getTime() } } };
				} else {
					OpenSearchOption.body.query.bool.must[OpenSearchOption.body.query.bool.must.length - 1 ] = { range: { createdAt: { lt: this.idService.parse(notes[notes.length -1 ]._id).date.getTime() } } };
				}
			}
		}
		return FilterdNotes;
	}
}
