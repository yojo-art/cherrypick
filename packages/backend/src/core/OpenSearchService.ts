/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Client as OpenSearch } from '@opensearch-project/opensearch';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { MiNote } from '@/models/Note.js';
import type { NotesRepository, PollVotesRepository, PollsRepository, NoteReactionsRepository, ClipNotesRepository, NoteFavoritesRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { isQuote, isRenote } from '@/misc/is-renote.js';
import type Logger from '@/logger.js';
import { DriveService } from './DriveService.js';

const noteIndexBody = {
	mappings: {
		properties: {
			text: {
				type: 'text',
				analyzer: 'sudachi_analyzer',
				fields: {
					keyword: {
						type: 'keyword',
						ignore_above: 5120,
					},
				},
			},
			cw: {
				type: 'text',
				analyzer: 'sudachi_analyzer',
				fields: {
					keyword: {
						type: 'keyword',
						ignore_above: 128,
					},
				},
			},
			userId: { type: 'keyword' },
			userHost: { type: 'keyword' },
			createdAt: { type: 'date' },
			tags: { type: 'keyword' },
			fileIds: { type: 'keyword' },
			visibility: { type: 'keyword' },
			searchableBy: { type: 'keyword' },
			visibleUserIds: { type: 'keyword' },
			replyId: { type: 'keyword' },
			renoteId: { type: 'keyword' },
			pollChoices: {
				type: 'text',
				analyzer: 'sudachi_analyzer',
				fields: {
					keyword: {
						type: 'keyword',
					},
				},
			},
			referenceUserId: { type: 'keyword' },
			sensitiveFileCount: { type: 'byte' },
			nonSensitiveFileCount: { type: 'byte' },
			reactions: {
				type: 'nested',
				properties: {
					emoji: { type: 'keyword' },
					count: { type: 'short' },
				},
			},
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
};
@Injectable()
export class OpenSearchService {
	private opensearchNoteIndex: string | null = null;
	private renoteIndex: string;
	private reactionIndex: string;
	private pollVoteIndex: string;
	private favoriteIndex: string;

	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.opensearch)
		private opensearch: OpenSearch | null,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		@Inject(DI.pollVotesRepository)
		private pollVotesRepository: PollVotesRepository,

		@Inject(DI.noteReactionsRepository)
		private noteReactionsRepository: NoteReactionsRepository,

		@Inject(DI.clipNotesRepository)
		private clipNotesRepository: ClipNotesRepository,

		@Inject(DI.noteFavoritesRepository)
		private noteFavoritesRepository: NoteFavoritesRepository,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

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
			this.pollVoteIndex = `${config.opensearch.index}---pollvote`;//
			this.favoriteIndex = `${config.opensearch.index}---favorite`;//お気に入りとclip

			this.opensearchNoteIndex = notesIndexname;

			//noteIndex
			this.opensearch?.indices.exists({
				index: notesIndexname,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) {
					this.opensearch?.indices.create({
						index: notesIndexname,
						body: noteIndexBody,
					}).catch((error) => {
						this.logger.error(error);
					});
				}
			}).catch((error) => {
				this.logger.error(error);
			});

			//renoteIndex
			this.opensearch?.indices.exists({
				index: this.renoteIndex,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) {
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
					});
				}
			}).catch((error) => this.logger.error(error));

			//reactionIndex
			this.opensearch?.indices.exists({
				index: this.reactionIndex,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) {
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
					});
				}
			}).catch((error) => this.logger.error(error));

			//favoriteIndex
			this.opensearch?.indices.exists({
				index: this.favoriteIndex,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) {
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
					});
				}
			}).catch((error) => this.logger.error(error));

			//pollVoteIndex
			this.opensearch?.indices.exists({
				index: this.pollVoteIndex,
			}).then((indexExists) => {
				if (indexExists.statusCode === 404) {
					this.opensearch?.indices.create({
						index: this.pollVoteIndex,
						body: {
							mappings: {
								properties: {
									noteId: { type: 'keyword' },
									userId: { type: 'keyword' },
								},
							},
						},
					});
				}
			}).catch((error) => this.logger.error(error));
		} else {
			this.logger.info('OpenSearch is not available');
			this.opensearchNoteIndex = null;
		}

	}

	@bindThis
	public configuredOpensearch(): boolean{
		return	this.opensearchNoteIndex !== null;
	}


	@bindThis
	public async search(option: any, index: 'note' | 'renote' | 'reaction' | 'vote' | 'favorite'): Promise<any> {
		switch (index) {
			case 'note':
				option.index =this.opensearchNoteIndex;
				break;
			case 'renote':
				option.index =this.renoteIndex;
				break;
			case 'reaction':
				option.index =this.reactionIndex;
			break;
			case 'vote':
				option.index =this.pollVoteIndex;
			break;
			case 'favorite':
				option.index =this.favoriteIndex;
			break;
		}
		return await this.opensearch.search();
	}

	@bindThis
	public async indexNote(note: MiNote, choices?: string[]): Promise<void> {
		if (!this.opensearch) return;
		if (note.searchableBy === 'private' && note.userHost !== null) return;//リモートユーザーのprivateはインデックスしない

		if (isRenote(note) && !isQuote(note)) { //リノートであり
			if (note.userHost === null) {//ローカルユーザー
				if (note.renote?.searchableBy === 'private') return;//リノート元のノートがprivateならインデックスしない
				await this.index(this.renoteIndex, note.id, {
					renoteId: note.renoteId,
					userId: note.userId,
					createdAt: this.idService.parse(note.id).date.getTime(),
				});
				return;
			}
		}
		if (await this.redisClient.get('indexDeleted') !== null) {
			return;
		}
		const IsQuote = isRenote(note) && isQuote(note);
		const sensitiveCount = await this.driveService.getSensitiveFileCount(note.fileIds);
		const nonSensitiveCount = note.fileIds.length - sensitiveCount;
		let reactions: {
			emoji: string;
			count: number;
		}[];

		if (this.config.opensearch?.reactionSearchLocalOnly ?? false) {
			reactions = Object.entries(note.reactions).map(([emoji, count]) => ({ emoji, count })).filter((x) => !x.emoji.includes('@'));
		} else {
			reactions = Object.entries(note.reactions).map(([emoji, count]) => ({ emoji, count }));
		}

		const body = {
			text: note.text,
			cw: note.cw,
			userId: note.userId,
			userHost: note.userHost,
			createdAt: this.idService.parse(note.id).date.getTime(),
			tags: note.tags,
			fileIds: note.fileIds,
			visibility: note.visibility,
			searchableBy: note.searchableBy,
			visibleUserIds: note.visibleUserIds,
			replyId: note.replyId,
			renoteId: note.renoteId,
			pollChoices: choices,
			referenceUserId: note.replyId ? note.replyUserId : IsQuote ? note.renoteUserId : null,
			sensitiveFileCount: sensitiveCount,
			nonSensitiveFileCount: nonSensitiveCount,
			reactions: reactions,
		};
		this.index(this.opensearchNoteIndex as string, note.id, body);
	}

	@bindThis
	public async updateNoteSensitive(fileId: string) {
		if (!this.opensearch) return;

		const limit = 100;
		let latestid = undefined;

		while (true) {
			const notes = await this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), latestid, undefined)
				.andWhere(':file <@ note.fileIds', { file: [fileId] })
				.limit(limit)
				.getMany();

			if (notes.length === 0 ) break;

			notes.forEach((note) => {
				this.driveService.getSensitiveFileCount(note.fileIds)
					.then((sensitiveCount) => {
						const nonSensitiveCount = note.fileIds.length - sensitiveCount;
						const body = {
							fileIds: note.fileIds,
							sensitiveFileCount: sensitiveCount,
							nonSensitiveFileCount: nonSensitiveCount,
						};
						this.opensearch?.update({
							id: note.id,
							index: this.opensearchNoteIndex as string,
							body: { doc: body },
						});
					});
				latestid = note.id;
			});
		}
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
	public async indexReaction(opts: {
		id: string,
		noteId: string,
		userId: string,
		reaction: string,
		remote: boolean,
		reactionIncrement?: boolean,
		searchableBy?: string,
	}) {
		if (!(opts.remote && opts.searchableBy === 'private')) {
			await this.index(this.reactionIndex, opts.id, {
				noteId: opts.noteId,
				userId: opts.userId,
				reaction: opts.reaction,
				createdAt: this.idService.parse(opts.id).date.getTime(),
			});
		}
		if (opts.reactionIncrement === false) return;
		if (opts.remote && opts.searchableBy === 'private') return;
		if ((this.config.opensearch?.reactionSearchLocalOnly ?? false) && opts.remote && opts.reaction.includes('@')) return;

		await this.opensearch?.update({
			id: opts.noteId,
			index: this.opensearchNoteIndex as string,
			body: {
				script: {
					lang: 'painless',
					source: 'if (ctx._source.containsKey("reactions")) {' +
										'if (ctx._source.reactions.stream().anyMatch(r -> r.emoji == params.emoji))' +
										' { ctx._source.reactions.stream().filter(r -> r.emoji == params.emoji && r.count < 32700).forEach(r -> r.count += 1); }' +
										' else { ctx._source.reactions.add(params.record); }' +
									'} else { ctx._source.reactions = new ArrayList(); ctx._source.reactions.add(params.record);}',
					params: {
						emoji: opts.reaction,
						record: {
							emoji: opts.reaction,
							count: 1,
						},
					},
				},
			},
		}).catch((err) => this.logger.error(err));
	}

	@bindThis
	public async indexVote(
		id: string,
		opts: {
			noteId: string;
			userId: string;
		}) {
		await this.index(this.pollVoteIndex, id, {
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
				throw error;
			});

			await this.opensearch.indices.create({
				index: this.opensearchNoteIndex as string,
				body: noteIndexBody,
			},
			).catch((error) => {
				this.logger.error(error);
				throw error;
			});

			await this.redisClient.del('indexDeleted');
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
				.leftJoin('note.renote', 'renote')
				.select(['note'])
				.where('note.id > :latestid', { latestid })
				.andWhere(new Brackets( qb => {
					qb.where('note."userHost" IS NULL')
						.orWhere(new Brackets(qb2 => {
							qb2
								.where('note."userHost" IS NOT NULL')
								.andWhere('note."searchableBy" != \'private\'')
								.orWhere('note."searchableBy" IS NULL');
						}));
				}))
				.orderBy('note.id', 'ASC')
				.limit(limit)
				.getMany();
			notes.forEach(note => {
				if (note.hasPoll) {
					this.pollsRepository.findOneBy({ noteId: note.id }).then( (poll) => {
						this.indexNote(note, poll ? poll.choices : undefined);
					});
				} else {
					this.indexNote(note, undefined);
				}
				latestid = note.id;
			});
		}
		this.logger.info('All notes has been indexed.');
	}

	@bindThis
	public async fullIndexReaction(): Promise<void> {
		if (!this.opensearch) return;

		const reactionsCount = await this.noteReactionsRepository.createQueryBuilder('reac').getCount();
		const limit = 100;
		let latestid = '';
		for (let index = 0; index < reactionsCount; index += limit) {
			this.logger.info('indexing' + index + '/' + reactionsCount);

			const reactions = await this.noteReactionsRepository
				.createQueryBuilder('reac')
				.where('reac.id > :latestid', { latestid })
				.innerJoin('reac.user', 'user')
				.leftJoin('reac.note', 'note')
				.select(['reac', 'note.searchableBy'])
				.andWhere('user.host IS NULL')
				.orderBy('reac.id', 'ASC')
				.limit(limit)
				.getMany();
			reactions.forEach(reac => {
				this.indexReaction({
					id: reac.id,
					noteId: reac.noteId,
					userId: reac.userId,
					reaction: reac.reaction,
					remote: false,
					reactionIncrement: false,
					searchableBy: reac.note?.searchableBy === null ? undefined : reac.note?.searchableBy,
				});
				latestid = reac.id;
			});
		}
		this.logger.info('All reactions has been indexed.');
	}

	@bindThis
	public async fullIndexPollVote(): Promise<void> {
		const pollVotesCount = await this.pollVotesRepository.createQueryBuilder('pv').getCount();
		const limit = 100;
		let latestid = '';
		for (let index = 0; index < pollVotesCount; index += limit) {
			this.logger.info('indexing' + index + '/' + pollVotesCount);

			const votes = await this.pollVotesRepository
				.createQueryBuilder('pv')
				.where('pv.id > :latestid', { latestid })
				.innerJoin('pv.user', 'user')
				.select(['pv', 'user.host'])
				.leftJoin('reac.note', 'note')
				.andWhere('user.host IS NULL')
				.orderBy('pv.id', 'ASC')
				.limit(limit)
				.getMany();
			if (votes.length === 0) { break; }
			votes.forEach(pollVote => {
				this.indexVote(pollVote.id, {
					noteId: pollVote.noteId,
					userId: pollVote.userId,
				});
				latestid = pollVote.id;
			});
		}
		this.logger.info('All pollvotes has been indexed.');
	}

	@bindThis
	public async fullIndexClipNotes(): Promise<void> {
		const clipsCount = await this.clipNotesRepository.createQueryBuilder('clipnote').getCount();
		const limit = 100;
		let latestid = '';
		for (let index = 0; index < clipsCount; index += limit) {
			this.logger.info('indexing' + index + '/' + clipsCount);

			const clipNotes = await this.clipNotesRepository
				.createQueryBuilder('clipnote')
				.innerJoin('clipnote.clip', 'clip')
				.select(['clipnote', 'clip.userId'])
				.where('clipnote.id > :latestid', { latestid })
				.orderBy('clipnote.id', 'ASC')
				.limit(limit)
				.getMany();
			clipNotes.forEach(clipNote => {
				this.indexFavorite(clipNote.id, {
					noteId: clipNote.noteId,
					userId: clipNote.clip?.userId as string,
					clipId: clipNote.clipId,
				});
				latestid = clipNote.id;
			});
		}
	}

	public async fullIndexFavorites(): Promise<void> {
		const clipsCount = await this.noteFavoritesRepository.createQueryBuilder('fv').getCount();
		const limit = 100;
		let latestid = '';
		for (let index = 0; index < clipsCount; index += limit) {
			this.logger.info('indexing' + index + '/' + clipsCount);

			const favorites = await this.noteFavoritesRepository
				.createQueryBuilder('fv')
				.orderBy('fv.id', 'ASC')
				.where('fv.id > :latestid', { latestid })
				.innerJoin('reac.note', 'note')
				.limit(limit)
				.getMany();
			favorites.forEach(favorite => {
				this.indexFavorite(favorite.id, {
					noteId: favorite.noteId,
					userId: favorite.userId,
				});
				latestid = favorite.id;
			});
		}
	}

	@bindThis
	private async unindexById(index: string, id: string) {
		if (!this.opensearch) return;
		this.opensearch.delete({
			index: index,
			id: id,
		}).catch((error) => {
			if (error.type === 'version_conflict_engine_exception') {
				this.unindexById(index, id);
			} else {
				this.logger.error(error);
			}
		});
	}

	@bindThis
	private async unindexByQuery(index: string, query: any) {
		if (!this.opensearch) return;
		this.opensearch.deleteByQuery({
			index: index,
			body: {
				query: query,
			},
		}).catch((error) => {
			this.logger.error(error);
		});
	}

	@bindThis
	public async unindexNote(note: MiNote): Promise<void> {
		if (await this.redisClient.get('indexDeleted') !== null) {
			return;
		}
		if (note.text == null && note.cw == null && note.fileIds.length === 0 && note.renoteId) {
			//Renoteを消しとく
			await this.unindexById(this.renoteIndex, note.id);
			return;
		}
		await this.unindexById(this.opensearchNoteIndex as string, note.id);
		//Renoteの削除
		await this.unindexByQuery(this.opensearchNoteIndex as string, {
			term: {
				renoteId: {
					value: note.id,
				},
			},
		});
		//クリップとお気に入りの削除
		await this.unindexByQuery(this.favoriteIndex, {
			term: {
				noteId: {
					value: note.id,
				},
			},
		});
		//投票の削除
		await this.unindexByQuery(this.pollVoteIndex, {
			term: {
				noteId: {
					value: note.id,
				},
			},
		});
		//リアクションの削除
		await this.unindexByQuery(this.reactionIndex, {
			term: {
				noteId: {
					value: note.id,
				},
			},
		});
	}

	@bindThis
	public async unindexReaction(id: string, remote: boolean, noteId: string, emoji:string): Promise<void> {
		if (!remote) this.unindexById(this.reactionIndex, id);
		if ((this.config.opensearch?.reactionSearchLocalOnly ?? false) && remote && emoji.includes('@')) return;
		await this.opensearch?.update({
			id: noteId,
			index: this.opensearchNoteIndex as string,
			body: {
				script: {
					lang: 'painless',
					source: 'if (ctx._source.containsKey("reactions")) {' +
										'for (int i = 0; i < ctx._source.reactions.length; i++) {' +
										' if (ctx._source.reactions[i].emoji == params.emoji) { ctx._source.reactions[i].count -= 1;' +
										//DBに格納されるノートのリアクションデータは数が0でも保持されるのでそれに合わせてデータを消さない
										//' if (ctx._source.reactions[i].count <= 0) { ctx._source.reactions.remove(i) }' +
										'break; }' +
										'}' +
									'}',
					params: {
						emoji: emoji,
					},
				},
			},
		}).catch((err) => this.logger.error(err));
	}
	/**
	 * Favoriteだけどクリップもここ
	 */
	@bindThis
	public async unindexFavorite(id?: string, noteId?: string, clipId?: string, userId?: string) {
		if (clipId) {
			this.unindexByQuery(this.favoriteIndex, {
				bool: {
					must: [
						{ term: { noteId: { value: noteId } } },
						{ term: { clipId: { value: clipId } } },
						{ term: { userId: { value: userId } } },
					],
				},
			});
		} else {
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
		}
	}

	/**
	 * クリップが消されたときにクリップされたものを消す
	 */
	@bindThis
	public async unindexUserClip(id: string) {
		await this.unindexByQuery(this.favoriteIndex, {
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
		await this.unindexByQuery(this.favoriteIndex,
			{
				term: {
					userId: {
						value: id,
					},
				},
			});
	}
}
