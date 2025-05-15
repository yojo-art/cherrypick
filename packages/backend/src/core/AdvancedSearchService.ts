/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { MiNote } from '@/models/Note.js';
import { MiUser } from '@/models/_.js';
import type { NotesRepository, UsersRepository } from '@/models/_.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { CacheService } from '@/core/CacheService.js';
import { OpenSearchService } from '@/core/OpenSearchService.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type Logger from '@/logger.js';

type OpenSearchHit = {
	_index: string
	_id: string
	_score?: number
	_source:{
		id: string
		userId: string
		visibility: string
		searchableBy: string
		visibleUserIds?: string[]
		referenceUserId?: string
		noteId?: string
	}
};
type K = string;
type V = string | number | boolean;
type Q =
	{ op: '=', k: K, v: V } |
	{ op: '!=', k: K, v: V } |
	{ op: '>', k: K, v: number } |
	{ op: '<', k: K, v: number } |
	{ op: '>=', k: K, v: number } |
	{ op: '<=', k: K, v: number } |
	{ op: 'is null', k: K } |
	{ op: 'is not null', k: K } |
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

@Injectable()
export class AdvancedSearchService {

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private cacheService: CacheService,
		private openSearchService: OpenSearchService,
		private queryService: QueryService,
		private idService: IdService,
	) {
	}

	@bindThis
	public async searchOrFail(me: MiUser | null, opts: {
		reactions?: string[] | null;
		reactionsExclude?: string[] | null;
		userId?: MiNote['userId'] | null;
		host?: string | null;
		origin?: string | null;
		fileOption?: string | null;
		visibility?: MiNote['visibility'] | null;
		excludeCW?: boolean;
		excludeReply?: boolean;
		excludeQuote?: boolean;
		sensitiveFilter?: string | null;
		followingFilter?: string | null;
		offset?: number | null;
		useStrictSearch?: boolean | null;
		wildCard?: boolean;
	}, pagination: {
		untilId?: MiNote['id'];
		sinceId?: MiNote['id'];
		limit?: number;
	},
	q?: string): Promise<MiNote[]> {
		if (!this.openSearchService.configuredOpensearch()) throw new Error('OpenSearch is not available');
		return await this.searchNote(me, opts, pagination, q);
	}

	/**
	 * エンドポイントから呼ばれるところ
	 */
	@bindThis
	public async searchNote(me: MiUser | null, opts: {
		reactions?: string[] | null;
		reactionsExclude?: string[] | null;
		userId?: MiNote['userId'] | null;
		host?: string | null;
		origin?: string | null;
		fileOption?: string | null;
		visibility?: MiNote['visibility'] | null;
		excludeCW?: boolean;
		excludeReply?: boolean;
		excludeQuote?: boolean;
		sensitiveFilter?: string | null;
		followingFilter?: string | null;
		offset?: number | null;
		useStrictSearch?: boolean | null;
		wildCard?: boolean;
	}, pagination: {
		untilId?: MiNote['id'];
		sinceId?: MiNote['id'];
		limit?: number;
	},
	q?: string): Promise<MiNote[]> {
		if (this.openSearchService.configuredOpensearch()) {
			const osFilter: any = {
				bool: {
					must: [],
					must_not: [],
				},
			};

			if (pagination.untilId) osFilter.bool.must.push({ range: { createdAt: { lt: this.idService.parse(pagination.untilId).date.getTime() } } });
			if (pagination.sinceId) osFilter.bool.must.push({ range: { createdAt: { gt: this.idService.parse(pagination.sinceId).date.getTime() } } });
			if (opts.reactions && 0 < opts.reactions.length ) {
				const reactionsQuery = {
					nested: {
						path: 'reactions',
						query: {
							bool: {
								should: [
									{ range: { 'reactions.count': { gte: 1 } } },
								],
								minimum_should_match: 2,
							},
						},
					},
				} as any;
				opts.reactions.forEach( (reaction) => {
					reactionsQuery.nested.query.bool.should.push({ wildcard: { 'reactions.emoji': { value: reaction } } });
				});
				osFilter.bool.must.push(reactionsQuery);
			}

			if (opts.reactionsExclude && 0 < opts.reactionsExclude.length) {
				const reactionsExcludeQuery = {
					nested: {
						path: 'reactions',
						query: {
							bool: {
								should: [
									{ range: { 'reactions.count': { gte: 1 } } },
								],
								minimum_should_match: 2,
							},
						},
					},
				} as any;
				opts.reactionsExclude.forEach( (reaction) => {
					reactionsExcludeQuery.nested.query.bool.should.push({ wildcard: { 'reactions.emoji': { value: reaction } } });
				});
				osFilter.bool.must_not.push(reactionsExcludeQuery);
			}

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
			if (opts.excludeQuote) osFilter.bool.must_not.push({ exists: { field: 'renoteId' } });

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

			if (q && q !== '') {
				if (opts.useStrictSearch) {
					const query = opts.wildCard ? `*${q}*` : q;
					osFilter.bool.must.push({
						bool: {
							should: [
								{ wildcard: { 'text.keyword': query } },
								{ wildcard: { 'cw.keyword': query } },
								{ wildcard: { 'pollChoices.keyword': query } },
								{ wildcard: { 'tags': query } },
							],
							minimum_should_match: 1,
						},
					});
				} else {
					const fields = ['tags', 'text', 'pollChoices'];
					if (!opts.excludeCW)fields.push('cw');
					osFilter.bool.must.push({ simple_query_string: {
						fields: fields, 'query': q,
						default_operator: 'and',
					},
					});
				}
			}

			const Option = {
				index: '',
				body: {
					query: osFilter,
					sort: [{ createdAt: { order: 'desc' } }],
				},
				_source: me ? ['userId', 'visibility', 'visibleUserIds', 'referenceUserId', 'searchableBy'] : ['userId', 'visibility'],
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
				osFilter.bool.must.push({
					bool: {
						should: [
							{ term: { searchableBy: 'public' } },
							{ bool: { must_not: { exists: { field: 'searchableBy' } } } },
						],
						minimum_should_match: 1,
					},
				});
			}

			const Result = await this.search(Option, pagination.untilId ? 1 : 0, opts.followingFilter ?? 'combined', me ? me.id : undefined);
			if (Result.length === 0) {
				return [];
			}

			const noteIds = Result.sort((a, b) => a._id > b._id ? -1 : 1).map((hit: any) => hit._id);

			return (await this.notesRepository.findBy({
				id: In(noteIds),
			})).sort((a, b) => a.id > b.id ? -1 : 1);
		} else {
			if (opts.reactions) {
				throw new IdentifiableError('084b2eec-7b60-4382-ae49-3da182d27a9a', 'Unimplemented');
			} else if (opts.reactionsExclude) {
				throw new IdentifiableError('084b2eec-7b60-4382-ae49-3da182d27a9a', 'Unimplemented');
			}
			const query = this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), pagination.sinceId, pagination.untilId);

			if (opts.userId) {
				query.andWhere('note.userId = :userId', { userId: opts.userId });
			}

			if (opts.origin === 'local') {
				query.andWhere('note.userHost IS NULL');
			} else if (opts.origin === 'remote') {
				query.andWhere('note.userHost IS NOT NULL');
			}

			if (q && q !== '') {
				if (this.config.fulltextSearch?.provider === 'sqlPgroonga') {
					query.andWhere('note.text &@~ :q', { q: `%${sqlLikeEscape(q)}%` });
				} else {
					query.andWhere('note.text ILIKE :q', { q: `%${sqlLikeEscape(q)}%` });
				}
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

			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);
			if (opts.followingFilter) {
				this.queryService.generateVisibilityQuery(query, me, { search: true, followingFilter: opts.followingFilter });
			} else {
				this.queryService.generateVisibilityQuery(query, me, { search: true });
			}
			return await query.limit(pagination.limit).getMany();
		}
	}

	@bindThis
	private async search(
		OpenSearchOption: any,
		untilAvail: number,
		followingFilter: string,
		meUserId?: string,
	): Promise<any[]> {
		/*ブロックされている or ミュートしているフィルタ*/
		const userIdsWhoMeMuting = meUserId ? await this.cacheService.userMutingsCache.fetch(meUserId) : new Set<string>;
		const	userIdsWhoMeBlockingMe = meUserId ? await this.cacheService.userBlockedCache.fetch(meUserId) : new Set<string>;
		const Filter = Array.from(userIdsWhoMeMuting).concat(Array.from(userIdsWhoMeBlockingMe));

		let Followings = [] as string[];
		if (meUserId) {
			const FollowingsCache = await this.cacheService.userFollowingsCache.fetch(meUserId);
			Followings = Object.keys(FollowingsCache);
		}
		let notes = [] as OpenSearchHit[];
		const FilterdNotes = [] as OpenSearchHit[];
		while ( FilterdNotes.length < OpenSearchOption.size) {
			const res = await this.openSearchService.search(OpenSearchOption, 'note');
			notes = res.body.hits.hits as OpenSearchHit[];
			if (notes.length === 0) break;//これ以上探してもない

			const resultPromises = notes.map(x => this.filter(x, Filter, Followings, followingFilter, meUserId));
			const Results = (await Promise.all(resultPromises)).filter( (x) => x !== null);

			if (Results.length > 0) {
				const Filterd = Results.sort((a, b) => a._id > b._id ? -1 : 1);

				for (let i = 0; FilterdNotes.length < OpenSearchOption.size && i < Filterd.length; i++) {
					FilterdNotes.push(Filterd[i]);
				}
			} else break;

			if ( FilterdNotes.length === OpenSearchOption.size) break;

			//until指定
			if (untilAvail === 1) {
				OpenSearchOption.body.query.bool.must[0] = { range: { createdAt: { lt: this.idService.parse(notes[notes.length - 1 ]._id).date.getTime() } } };
			} else if (untilAvail === 0) {
				OpenSearchOption.body.query.bool.must.push({ range: { createdAt: { lt: this.idService.parse(notes[notes.length - 1 ]._id).date.getTime() } } });
			} else {
				OpenSearchOption.body.query.bool.must[OpenSearchOption.body.query.bool.must.length - 1 ] = { range: { createdAt: { lt: this.idService.parse(notes[notes.length - 1 ]._id).date.getTime() } } };
			}
		}
		return FilterdNotes;
	}

	@bindThis
	private async filter (
		Note: OpenSearchHit,
		Filter: string[],
		Followings: string[],
		followingFilter: string,
		meUserId?: string ): Promise<OpenSearchHit | null> {
		if (meUserId) {
			if (Note._source.userId === meUserId) return Note;//自分のノート
			//ミュートしているか、ブロックされている
			if (Filter.includes(Note._source.userId) ) return null;
			if (Note._source.referenceUserId) {
				if (Filter.includes(Note._source.referenceUserId)) return null;
			}

			const followed = Followings.includes(Note._source.userId);
			if (Note._source.visibility === 'followers' && !followed) return null;//鍵でフォローしてない
			if (Note._source.visibility === 'specified' && Note._source.visibleUserIds && !Note._source.visibleUserIds.includes(meUserId)) return null; //ダイレクトで自分が宛先に含まれていない

			if (followingFilter === 'following' && !followed) return null;
			if (followingFilter === 'notFollowing' && followed) return null;

			let requireReaction = false;
			const user = await this.cacheService.findUserById(Note._source.userId);
			switch (Note._source.searchableBy) {
				case 'public':
					return Note;
				case 'private':
					return null;
				case 'followersAndReacted':
					if (followed) return Note;
					requireReaction = true;
					break;
				case 'reactedOnly':
					requireReaction = true;
					break;
			}

			if (!requireReaction) {
				if (user.searchableBy) {
					switch (user.searchableBy) {
						case 'public':
							return Note;
						case 'private':
							return null;
						case 'followersAndReacted':
							if (followed) return Note;
							requireReaction = true;
							break;
						case 'reactedOnly':
							requireReaction = true;
							break;
					}
				} else {
					if (user.isIndexable) return Note;
					requireReaction = true;
				}
			}

			if (requireReaction) { //検索許可されていないが、

				const Option = {
					index: '',
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
				let res = await this.openSearchService.search(Option, 'reaction');
				if (res.body.hits.total.value > 0) {
					return Note;
				}

				//投票しているか、
				res = await this.openSearchService.search(Option, 'vote');
				if (res.body.hits.total.value > 0) {
					return Note;
				}

				//クリップもしくはお気に入りしてる
				res = await this.openSearchService.search(Option,'favorite');
				if (res.body.hits.total.value > 0) {
					return Note;
				}

				//Renoteしている
				Option.body.query.bool.must = [
					{ term: { renoteId: Note._id } },
					{ term: { userId: meUserId } },
				];
				res = await this.openSearchService.search(Option, 'renote');
				if (res.body.hits.total.value > 0) {
					return Note;
				}
				//返信している
				Option.body.query.bool.must = [
					{ term: { replyId: Note._id } },
					{ term: { userId: meUserId } },
				];

				res = await this.openSearchService.search(Option,'note');
				if (res.body.hits.total.value > 0) {
					return Note;
				}

				return null;
			}
		} else {
			if (Note._source.searchableBy === 'public') return Note;
			const user = await this.cacheService.findUserById(Note._source.userId);
			if (user.searchableBy === 'public') return Note;
			if (user.isIndexable) return Note;
		}
		return null;
	}
}
