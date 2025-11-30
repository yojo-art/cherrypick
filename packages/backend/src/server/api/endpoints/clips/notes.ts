/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import got, * as Got from 'got';
import * as Redis from 'ioredis';
import type { Config } from '@/config.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { NotesRepository, ClipsRepository, ClipNotesRepository, MiNote } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import { MetaService } from '@/core/MetaService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { ApLoggerService } from '@/core/activitypub/ApLoggerService.js';
import { ApClipService } from '@/core/activitypub/models/ApClipService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account', 'notes', 'clips'],

	requireCredential: false,

	kind: 'read:account',

	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: '1d7645e6-2b6d-4635-b0fe-fe22b0e72e00',
		},
		invalidIdFormat: {
			message: 'Invalid id format.',
			code: 'INVALID_ID_FORMAT',
			id: '42d11fe5-686e-41ee-9e7f-e804ec3a388d',
		},
		failedToResolveRemoteUser: {
			message: 'failedToResolveRemoteUser.',
			code: 'FAILED_TO_RESOLVE_REMOTE_USER',
			id: 'af0ecffc-8717-409e-a8d4-e1e3a5d2497f',
		},
	},

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		clipId: { type: 'string' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: ['clipId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.clipNotesRepository)
		private clipNotesRepository: ClipNotesRepository,
		@Inject(DI.redisForRemoteApis)
		private redisForRemoteApis: Redis.Redis,

		private httpRequestService: HttpRequestService,
		private apNoteService: ApNoteService,
		private metaService: MetaService,
		private utilityService: UtilityService,

		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
		private apLoggerService: ApLoggerService,
		private apClipService: ApClipService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const parsed_id = ps.clipId.split('@');
			let notes = [];
			if (parsed_id.length === 2 ) {//is remote
				const url = 'https://' + parsed_id[1] + '/api/clips/notes';
				apLoggerService.logger.debug('remote clip ' + url);
				notes = await remote(config, httpRequestService, redisForRemoteApis, apNoteService, metaService, utilityService, apLoggerService, url, parsed_id[0], parsed_id[1], ps.clipId, ps.limit, ps.sinceId, ps.untilId);
			} else if (parsed_id.length === 1 ) {//is not local
				const clip = await this.clipsRepository.findOneBy({
					id: ps.clipId,
				});

				if (clip == null) {
					throw new ApiError(meta.errors.noSuchClip);
				}

				if (!clip.isPublic && (me == null || (clip.userId !== me.id))) {
					throw new ApiError(meta.errors.noSuchClip);
				}
				if (clip.uri) {
					if (clip.lastFetchedAt == null || Date.now() - clip.lastFetchedAt.getTime() > 1000 * 60 * 60 * 24) {
						this.clipsRepository.update(clip.id, {
							lastFetchedAt: new Date(),
						});
						this.apClipService.updateItems(clip).catch(e => {
							apLoggerService.logger.warn('clip fetch failed ' + e);
						}).then(() => {
							apLoggerService.logger.info('clip update:' + clip.uri);
						});
					}
				}

				const query = this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), ps.sinceId, ps.untilId)
					.innerJoin(this.clipNotesRepository.metadata.targetName, 'clipNote', 'clipNote.noteId = note.id')
					.innerJoinAndSelect('note.user', 'user')
					.leftJoinAndSelect('note.reply', 'reply')
					.leftJoinAndSelect('note.renote', 'renote')
					.leftJoinAndSelect('reply.user', 'replyUser')
					.leftJoinAndSelect('renote.user', 'renoteUser')
					.andWhere('clipNote.clipId = :clipId', { clipId: clip.id });

				this.queryService.generateVisibilityQuery(query, me);
				this.queryService.generateBlockedHostQueryForNote(query);
				// this.queryService.generateSuspendedUserQueryForNote(query); // To avoid problems with removing notes, ignoring suspended user for now
				if (me) {
						this.queryService.generateMutedUserQueryForNotes(query, me);
					this.queryService.generateBlockedUserQueryForNotes(query, me);
				}

				notes = await query
					.limit(ps.limit)
					.getMany();
			} else {
				throw new ApiError(meta.errors.invalidIdFormat);
			}

			return await this.noteEntityService.packMany(notes, me);
		});
	}
}

async function remote(
	config:Config,
	httpRequestService: HttpRequestService,
	redisForRemoteApis: Redis.Redis,
	apNoteService: ApNoteService,
	metaService: MetaService,
	utilityService: UtilityService,
	apLoggerService: ApLoggerService,
	url:string,
	clipId:string,
	host:string,
	local_id:string,
	limit:number,
	sinceId:string | undefined,
	untilId:string | undefined,
) {
	const cache_key = 'clip:notes:' + local_id + '-' + (sinceId ? sinceId : '') + '-' + (untilId ? untilId : '') + '-' + limit;
	const cache_value = await redisForRemoteApis.get(cache_key);
	let remote_json = null;
	if (cache_value === null) {
		//リモートのノートIDを対応するローカルのノートIDに解決する
		const sinceIdRemote = sinceId ? await redisForRemoteApis.get('local-noteId:' + sinceId + '@' + host) : undefined;
		const untilIdRemote = untilId ? await redisForRemoteApis.get('local-noteId:' + untilId + '@' + host) : undefined;
		const timeout = 30 * 1000;
		const operationTimeout = 60 * 1000;
		const res = got.post(url, {
			headers: {
				'User-Agent': config.userAgent,
				'Content-Type': 'application/json; charset=utf-8',
			},
			timeout: {
				lookup: timeout,
				connect: timeout,
				secureConnect: timeout,
				socket: timeout,	// read timeout
				response: timeout,
				send: timeout,
				request: operationTimeout,	// whole operation timeout
			},
			agent: {
				http: httpRequestService.httpAgent,
				https: httpRequestService.httpsAgent,
			},
			http2: true,
			retry: {
				limit: 1,
			},
			enableUnixSockets: false,
			body: JSON.stringify({
				clipId,
				limit,
				sinceId: sinceIdRemote,
				untilId: untilIdRemote,
			}),
		});
		remote_json = await res.text();
		const redisPipeline = redisForRemoteApis.pipeline();
		redisPipeline.set(cache_key, remote_json);
		redisPipeline.expire(cache_key, 10 * 60);
		await redisPipeline.exec();
	} else {
		remote_json = cache_value;
	}
	const remote_notes = JSON.parse(remote_json);
	//リモートに照会する回数の上限
	const create_limit = 5;
	let create_count = 0;
	const notes = [];
	for (const note of remote_notes) {
		const uri = note.uri ? note.uri : 'https://' + host + '/notes/' + note.id;
		if (uri !== null) {
			if (create_count > create_limit) {
				break;
			}
			const local_note = await remoteNote(apNoteService, uri, redisForRemoteApis, metaService, utilityService, apLoggerService, host, note.id);
			if (local_note !== null) {
				if (local_note.is_create) {
					create_count++;
				}
				notes.push(local_note.note);
			}
		}
	}
	return notes;
}

class RemoteNote {
	note: MiNote;
	is_create: boolean;
}

async function remoteNote(
	apNoteService: ApNoteService,
	uri: string,
	redisForRemoteApis: Redis.Redis,
	metaService: MetaService,
	utilityService: UtilityService,
	apLoggerService: ApLoggerService,
	host:string,
	remote_note_id:string,
): Promise<RemoteNote | null> {
	const fetchedMeta = await metaService.fetch();
	apLoggerService.logger.debug('remote clip note fetch ' + uri);
	let note;
	let is_create = false;
	try {
		//ブロックされたインスタンスの投稿は無かった事にする
		if (utilityService.isBlockedHost(fetchedMeta.blockedHosts, utilityService.extractDbHost(uri))) return null;
		//ローカルのDBから取得を試みる
		note = await apNoteService.fetchNote(uri);
		if (note == null) {
			//ダメそうなら照会
			note = await apNoteService.createNote(uri, undefined, undefined, true);
			is_create = true;
		}
	} catch (e) {
		apLoggerService.logger.warn(String(e));
		//照会失敗した時はクリップ内に無かった事にする
		return null;
	}
	if (note !== null) {
		redisForRemoteApis.set('local-noteId:' + note.id + '@' + host, remote_note_id);
		return {
			note,
			is_create,
		};
	} else {
		return null;
	}
}
