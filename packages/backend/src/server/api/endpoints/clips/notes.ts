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
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import { IObject } from '@/core/activitypub/type.js';
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
		@Inject(DI.redisForRemoteClips)
		private redisForRemoteClips: Redis.Redis,

		private httpRequestService: HttpRequestService,
		private userEntityService: UserEntityService,
		private remoteUserResolveService: RemoteUserResolveService,
		private apNoteService: ApNoteService,

		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const parsed_id = ps.clipId.split('@');
			let notes = [];
			if (parsed_id.length === 2 ) {//is remote
				const url = 'https://' + parsed_id[1] + '/api/clips/notes';
				console.log(url);
				notes = await remote(config, httpRequestService, userEntityService, remoteUserResolveService, redisForRemoteClips, apNoteService, url, parsed_id[0], parsed_id[1], ps.clipId, ps.limit, ps.sinceId, ps.untilId);
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

				const query = this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), ps.sinceId, ps.untilId)
					.innerJoin(this.clipNotesRepository.metadata.targetName, 'clipNote', 'clipNote.noteId = note.id')
					.innerJoinAndSelect('note.user', 'user')
					.leftJoinAndSelect('note.reply', 'reply')
					.leftJoinAndSelect('note.renote', 'renote')
					.leftJoinAndSelect('reply.user', 'replyUser')
					.leftJoinAndSelect('renote.user', 'renoteUser')
					.andWhere('clipNote.clipId = :clipId', { clipId: clip.id });

				if (me) {
					this.queryService.generateVisibilityQuery(query, me);
					this.queryService.generateMutedUserQuery(query, me);
					this.queryService.generateBlockedUserQuery(query, me);
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
	userEntityService: UserEntityService,
	remoteUserResolveService: RemoteUserResolveService,
	redisForRemoteClips: Redis.Redis,
	apNoteService: ApNoteService,
	url:string,
	clipId:string,
	host:string,
	local_id:string,
	limit:number,
	sinceId:string|undefined,
	untilId:string|undefined,
) {
	const cache_value = await redisForRemoteClips.get(local_id);
	let remote_json = null;
	if (cache_value === null) {
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
			}),
		});
		remote_json = await res.text();
	}
	if (remote_json === null) {
		throw new ApiError(meta.errors.noSuchClip);
	}
	const remote_notes = JSON.parse(remote_json);
	const notes_or_null = [];
	for (const note of remote_notes) {
		if (note.uri !== null) {
			notes_or_null.push(remoteNote(apNoteService, note.uri, redisForRemoteClips, host, note.id));
		}
	}
	const some_notes = [];
	for (const note of await awaitAll(notes_or_null)) {
		if (note !== null)some_notes.push(note);
	}
	return some_notes;
}

async function remoteNote(
	apNoteService: ApNoteService,
	object: string | IObject,
	redisForRemoteClips: Redis.Redis,
	host:string,
	remote_note_id:string,
): Promise<MiNote | null> {
	//取得or null
	console.log(object);
	const note = await apNoteService.fetchNote(object);
	if (note !== null) {
		redisForRemoteClips.sadd(note.id + '@' + host, remote_note_id);
	}
	return note;
}
