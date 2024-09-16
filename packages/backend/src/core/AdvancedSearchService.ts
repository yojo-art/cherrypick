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
import type { NotesRepository, UsersRepository, PollsRepository } from '@/models/_.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { CacheService } from '@/core/CacheService.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { isQuote, isRenote } from '@/misc/is-renote.js';
import type Logger from '@/logger.js';
import { DriveService } from './DriveService.js';

type OpenSearchHit = {
	_index: string
	_id: string
	_score?: number
	_source:{
    id: string
    userId: string
    visibility: string
    visibleUserIds?: string[]
		referenceUserId?: string
		noteId?: string
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
	private renoteIndex: string;
	private reactionIndex: string;
	private polledIndex: string;
	private favoriteIndex: string;

	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.opensearch)
		private opensearch: OpenSearch | null,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

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
			const notesIndexname = `${config.opensearch.index}---notes`;
			this.renoteIndex = `${config.opensearch.index}---renotes`;//単純Renoteだけここ
			this.reactionIndex = `${config.opensearch.index}---reaction`;
			this.polledIndex = `${config.opensearch.index}---polled`;//
			this.favoriteIndex = `${config.opensearch.index}---favorite`;//お気に入りとclip

			this.opensearchNoteIndex = notesIndexname;

			//noteIndex
			this.opensearch?.indices.exists({
				index: notesIndexname,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) [
					this.opensearch?.indices.create({
						index: notesIndexname,
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
									replyId: { type: 'keyword' },
									pollChoices: {
										type: 'text',
										analyzer: 'sudachi_analyzer',
										fields: {
											keyword: {
												type: 'keyword',
											},
										},
									},
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

			//renoteIndex
			this.opensearch?.indices.exists({
				index: this.renoteIndex,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) [
					this.opensearch?.indices.create({
						index: this.renoteIndex,
						body: {
							mappings: {
								properties: {
									renoteId: { type: 'keyword' },
									userId: { type: 'keyword' },
									createdAt: { type: 'date' },
								},
							},
						},
					}),
				];
			}).catch((error) => this.logger.error(error));

			//reactionIndex
			this.opensearch?.indices.exists({
				index: this.reactionIndex,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) [
					this.opensearch?.indices.create({
						index: this.reactionIndex,
						body: {
							mappings: {
								properties: {
									noteId: { type: 'keyword' },
									userId: { type: 'keyword' },
									createdAt: { type: 'date' },
									reaction: { type: 'keyword' },
								},
							},
						},
					}),
				];
			}).catch((error) => this.logger.error(error));

			//favoriteIndex
			this.opensearch?.indices.exists({
				index: this.favoriteIndex,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) [
					this.opensearch?.indices.create({
						index: this.favoriteIndex,
						body: {
							mappings: {
								properties: {
									noteId: { type: 'keyword' },
									userId: { type: 'keyword' },
									clipId: { type: 'keyword' },
								},
							},
						},
					}),
				];
			}).catch((error) => this.logger.error(error));

			//polledIndex
			this.opensearch?.indices.exists({
				index: this.polledIndex,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) [
					this.opensearch?.indices.create({
						index: this.polledIndex,
						body: {
							mappings: {
								properties: {
									noteId: { type: 'keyword' },
									userId: { type: 'keyword' },
								},
							},
						},
					}),
				];
			}).catch((error) => this.logger.error(error));
		} else {
			this.logger.info('OpenSearch is not available');
			this.opensearchNoteIndex = null;
		}
	}

	@bindThis
	public async indexNote(note: MiNote, choices?: string[]): Promise<void> {
		if (!this.opensearch) return;
		if (note.text == null && note.cw == null) {
			await this.index(this.renoteIndex, note.id, {
				renoteId: note.renoteId,
				userId: note.userId,
				createdAt: this.idService.parse(note.id).date.getTime(),
			});
			return;
		}
		if (await this.redisClient.get('indexDeleted') !== null) {
			return;
		}
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
			replyId: note.replyId,
			renoteId: note.renoteId,
			pollChoices: choices,
			referenceUserId: note.replyId ? note.replyUserId : IsQuote ? note.renoteUserId : null,
			sensitiveFileCount: sensitiveCount,
			nonSensitiveFileCount: nonSensitiveCount,
		};
		this.index(this.opensearchNoteIndex as string, note.id, body);
	}
	@bindThis
	private async index(index: string, id: string, body: any ) {
		if (!this.opensearch) return;
		await this.opensearch.index({
			index: index,
			id: id,
			body: body,
		}).catch((error) => {
			this.logger.error(error);
		});
	}
	/**
	 * リアクション
	 */
	@bindThis
	public async indexReacted(opts: {
		id: string,
		noteId: string,
		userId: string,
		reaction: string,
	}) {
		await this.index(this.reactionIndex, opts.id, {
			noteId: opts.noteId,
			userId: opts.userId,
			reaction: opts.reaction,
			createdAt: this.idService.parse(opts.id).date.getTime(),
		});
	}

	@bindThis
	public async indexVote(
		id: string,
		opts: {
			noteId: string;
			userId: string;
	}) {
		await this.index(this.polledIndex, id, {
			noteId: opts.noteId,
			userId: opts.userId,
		});
	}
	@bindThis
	public async indexFavorite(id: string,
		opts: {
		noteId: string,
		userId: string,
		clipId?: string,
	}) {
		this.index(this.favoriteIndex, id, opts);
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
							replyId: { type: 'keyword' },
							pollChoices: {
								type: 'text',
								analyzer: 'sudachi_analyzer',
								fields: {
									keyword: {
										type: 'keyword',
									},
								},
							},
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
				if (note.hasPoll) {
					this.pollsRepository.findOneBy({ noteId: note.id }).then( (poll) => {
						this.indexNote(note, poll ? poll.choices : undefined);
					});
				}
				this.indexNote(note, undefined);
				latestid = note.id;
			});
		}
		this.logger.info('All notes has been indexed.');
	}

	@bindThis
	private async unindexById(index: string, id: string) {
		if (!this.opensearch) return;
		this.opensearch.delete({
			index: index,
			id: id,
		}).catch((error) => {	console.error(error);});
	}
	@bindThis
	private async unindexByQuery(index: string, query: any) {
		if (!this.opensearch) return;
		this.opensearch.deleteByQuery({
			index: index,
			body: {
				query: query,
			},
		}).catch((error) => {	console.error(error);});
	}
	@bindThis
	public async unindexNote(note: MiNote): Promise<void> {
		if (await this.redisClient.get('indexDeleted') !== null) {
			return;
		}
		if (note.text == null && note.cw == null) {
			await this.unindexById(this.renoteIndex, note.id);
			return;
		}
		this.unindexById(this.opensearchNoteIndex as string, note.id);
	}

	@bindThis
	public async unindexReaction(id: string): Promise<void> {
		this.unindexById(this.reactionIndex, id);
	}
	/**
	 * Favoriteだけどクリップもここ
	 */
	@bindThis
	public async unindexFavorite(id?: string, noteId?: string, clipId?: string, userId?: string) {
		if (id) {
			this.unindexByQuery(this.favoriteIndex, {
				bool: {
					must: [
						{ term: { userId: { value: userId } } },
						{ term: { noteId: { value: noteId } } },
					],
					must_not: [
						{ exists: { field: 'clipId' } },
					],
				},
			});
		} else {
			this.unindexByQuery(this.favoriteIndex, {
				bool: {
					must: [
						{ term: { noteId: { value: noteId } } },
						{ term: { clipId: { value: clipId } } },
						{ exists: { field: 'clipId' } },
					],
				},
			});
		}
	}

	/**
	 * クリップが消されたときにクリップされたものを消す
	 */
	@bindThis
	public async unindexUserClip(id: string) {
		this.unindexByQuery(this.favoriteIndex, {
			term: {
				clipId: {
					 value: id,
				},
			},
		});
	}

	/**
	* user削除時に使う
	* お気に入りとクリップの削除
	* ノートは個別で削除されるからそこで
	*/
	@bindThis
	public async unindexUserFavorites (id: string) {
		this.unindexByQuery(this.favoriteIndex,
			{
				term: {
					userId: {
						 value: id,
					},
				},
			});
	}

	/**
	 * エンドポイントから呼ばれるところ
	 */
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
			if (opts.userId) {
				osFilter.bool.must.push({ term: { userId: opts.userId } });
				const user = await this.usersRepository.findOneBy({ id: opts.userId });
				if (user) {
					if (user.host) {
						osFilter.bool.must.push({ term: { userHost: user.host } });
					} else {
						osFilter.bool.must_not.push({ exists: { field: 'userHost' } });
					}
				}
			} else {
				if (opts.host) {
					if (opts.host === '.') {
						osFilter.bool.must_not.push({ exists: { field: 'userHost' } });
					} else {
						osFilter.bool.must.push({ term: { userHost: opts.host } });
					}
				}
			}
			if (opts.origin) {
				if (opts.origin === 'local') {
					osFilter.bool.must_not.push({ exists: { field: 'userHost' } });
				} else if (opts.origin === 'remote') {
					osFilter.bool.must.push({ exists: { field: 'userHost' } } );
				}
			}
			if (opts.excludeReply) osFilter.bool.must_not.push({ exists: { field: 'replyId' } });
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

			const Option = {
				index: this.opensearchNoteIndex as string,
				body: {
					query: osFilter,
					sort: [{ createdAt: { order: 'desc' } }],
				},
				_source: me ? ['userId', 'visibility', 'visibleUserIds', 'referenceUserId'] : ['visibility'],
				size: pagination.limit,
			} as any;

			if (opts.offset && 0 < opts.offset) {
				Option.from = opts.offset;
			}

			if (!me) {
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
			}

			const Result = await this.search(Option, pagination.untilId ? 1 : 0, me ? me.id : undefined);
			if (Result.length === 0) {
				return [];
			}

			const noteIds = Result.sort((a, b) => a._id > b._id ? -1 : 1).map((hit: any) => hit._id);

			return (await this.notesRepository.findBy({
				id: In(noteIds),
			})).sort((a, b) => a.id > b.id ? -1 : 1);
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
			this.queryService.generateSearchableQuery(query, me);
			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);

			return await query.limit(pagination.limit).getMany();
		}
	}

	@bindThis
	private async search(
		OpenSearchOption: any,
		untilAvail: number,
		meUserId?: string,
	): Promise<any[]> {
		if (!this.opensearch) throw new Error();
		let res = await this.opensearch.search(OpenSearchOption);
		let notes = res.body.hits.hits as OpenSearchHit[];

		if (notes.length === 0) return [];

		/*ブロックされている or ミュートしているフィルタ*/
		const userIdsWhoMeMuting = meUserId ? await this.cacheService.userMutingsCache.fetch(meUserId) : new Set<string>;
		const	userIdsWhoMeBlockingMe = meUserId ? await this.cacheService.userBlockingCache.fetch(meUserId) : new Set<string>;
		const Filter = Array.from(userIdsWhoMeMuting).concat(Array.from(userIdsWhoMeBlockingMe));

		let Followings: string[];
		Followings = [];
		if (meUserId) {
			const FollowingsCache = await this.cacheService.userFollowingsCache.fetch(meUserId);
			 Followings = Object.keys(FollowingsCache);
		}

		const resultPromises = [];

		for (const note of notes) {
    	const userResult = this.filter(note, Filter, Followings, meUserId);
   	 	resultPromises.push(userResult);
		}

		const FilterdNotes = (await Promise.all(resultPromises)).filter( (x) => x !== null).sort((a, b) => a._id > b._id ? -1 : 1);

		let retry = false;

		//フィルタされたノートが1件以上、最初のヒット件数が指定された数ではない
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

				if (notes.length === 0) break;//これ以上探してもない

				for (const note of notes) {
					const userResult = this.filter(note, Filter, Followings, meUserId);
					resultPromises.push(userResult);
				}
				const Filterd = (await Promise.all(resultPromises)).filter( (x) => x !== null);

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
					OpenSearchOption.body.query.bool.must[OpenSearchOption.body.query.bool.must.length - 1 ] = { range: { createdAt: { lt: this.idService.parse(notes[notes.length - 1 ]._id).date.getTime() } } };
				}
			}
		}
		return FilterdNotes;
	}

	@bindThis
	private async filter (
		Note: OpenSearchHit,
		Filter: string[],
		Followings: string[],
		meUserId?: string): Promise<OpenSearchHit| null> {
		if (meUserId) {
			if (Filter.includes(Note._source.userId) ) return null;
			if (Note._source.referenceUserId) {
				if (Filter.includes(Note._source.referenceUserId)) return null;
			}
		}

		const user = await this.cacheService.findUserById(Note._source.userId);
		if (user.id === meUserId) {
			return Note;
		} else {
			if (!user.isIndexable) { //検索許可されていないが、
				if (!this.opensearch) {
					return null;
				}

				const Option = {
					index: this.reactionIndex,
					body: {
						query: {
							bool: {
								must: [
									{ term: { noteId: Note._id } },
									{ term: { userId: meUserId } },
								],
							},
						},
					},
					_source: ['id', 'userId'],
					size: 1,
				} as any;

				//リアクションしているか、
				let res = await this.opensearch.search(Option);
				let hits = res.body.hits.hits as OpenSearchHit[];
				if (hits.length > 0) {
					return Note;
				}

				//投票しているか、
				Option.index = this.polledIndex;
				res = await this.opensearch.search(Option);
				hits = res.body.hits.hits as OpenSearchHit[];
				if (hits.length > 0) {
					return Note;
				}

				//クリップもしくはお気に入りしてるか、
				Option.index = this.favoriteIndex;
				res = await this.opensearch.search(Option);
				hits = res.body.hits.hits as OpenSearchHit[];
				if (hits.length > 0) {
					return Note;
				}

				//Renoteしている
				Option.index = this.renoteIndex;
				Option.body.query.bool.must = [
					{ term: { renoteId: Note._id } },
					{ term: { userId: meUserId } },
				];
				res = await this.opensearch.search(Option);
				hits = res.body.hits.hits as OpenSearchHit[];
				if (hits.length > 0) {
					return Note;
				}
				//返信している
				Option.index = this.opensearchNoteIndex as string;
				Option.body.query.bool.must = [
					{ term: { replyId: Note._id } },
					{ term: { userId: meUserId } },
				];

				res = await this.opensearch.search(Option);
				hits = res.body.hits.hits as OpenSearchHit[];
				if (hits.length > 0) {
					return Note;
				}

				return null;
			}
		}

		if (['public', 'home'].includes(Note._source.visibility)) return Note;//誰でも見れる

		if (meUserId) {
			if (Note._source.visibility === 'followers') { //鍵だけどフォローしてるか自分
				if (Note._source.userId === meUserId || Followings.includes(Note._source.userId)) return Note;
			}

			if (Note._source.visibility === 'specified') {
				if (Note._source.userId === meUserId) return Note;//自分の投稿したダイレクトか自分が宛先に含まれている
				if (Note._source.visibleUserIds) {
					if (Note._source.visibleUserIds.includes(meUserId)) return Note;
				}
			}
		}
		return null;
	}
}
