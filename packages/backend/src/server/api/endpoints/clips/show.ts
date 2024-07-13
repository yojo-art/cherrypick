/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import got, * as Got from 'got';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ClipsRepository } from '@/models/_.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['clips', 'account'],

	requireCredential: false,

	kind: 'read:account',

	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: 'c3c5fe33-d62c-44d2-9ea5-d997703f5c20',
		},
		invalidIdFormat: {
			message: 'Invalid id format.',
			code: 'INVALID_ID_FORMAT',
			id: 'df45c7d1-cd15-4a35-b3e1-8c9f987c4f5c',
		},
		failedToResolveRemoteUser: {
			message: 'failedToResolveRemoteUser.',
			code: 'FAILED_TO_RESOLVE_REMOTE_USER',
			id: '56d5e552-d55a-47e3-9f37-6dc85a93ecf9',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Clip',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		clipId: { type: 'string' },
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
		@Inject(DI.redisForRemoteClips)
		private redisForRemoteClips: Redis.Redis,

		private httpRequestService: HttpRequestService,
		private userEntityService: UserEntityService,
		private remoteUserResolveService: RemoteUserResolveService,
		private clipEntityService: ClipEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const parsed_id = ps.clipId.split('@');
			if (parsed_id.length === 2 ) {//is remote
				const url = 'https://' + parsed_id[1] + '/api/clips/show';
				console.log(url);
				return remote(config, httpRequestService, userEntityService, remoteUserResolveService, redisForRemoteClips, url, parsed_id[0], parsed_id[1], ps.clipId);
			}
			if (parsed_id.length !== 1 ) {//is not local
				throw new ApiError(meta.errors.invalidIdFormat);
			}
			// Fetch the clip
			const clip = await this.clipsRepository.findOneBy({
				id: ps.clipId,
			});

			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			if (!clip.isPublic && (me == null || (clip.userId !== me.id))) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			return await this.clipEntityService.pack(clip, me);
		});
	}
}

async function remote(
	config:Config,
	httpRequestService: HttpRequestService,
	userEntityService: UserEntityService,
	remoteUserResolveService: RemoteUserResolveService,
	redisForRemoteClips: Redis.Redis,
	url:string,
	clipId:string,
	host:string,
	local_id:string,
) {
	const cache_value = await redisForRemoteClips.get(local_id);
	let remote_json = null;
	if (cache_value === null) {
		const timeout = 30 * 1000;
		const operationTimeout = 60 * 1000;
		const res = got.post(url, {
			headers: {
				'User-Agent': config.userAgent,
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
			}),
		});
		remote_json = await res.text();
	}
	if (remote_json === null) {
		throw new ApiError(meta.errors.noSuchClip);
	}
	const remote_clip = JSON.parse(remote_json);
	const user = await remoteUserResolveService.resolveUser(remote_clip.username, host).catch(err => {
		throw new ApiError(meta.errors.failedToResolveRemoteUser);
	});
	return await awaitAll({
		id: local_id,
		createdAt: remote_clip.createdAt ? remote_clip.createdAt : null,
		lastClippedAt: remote_clip.lastClippedAt ? remote_clip.lastClippedAt : null,
		userId: user.id,
		user: userEntityService.pack(user),
		name: remote_clip.name,
		description: remote_clip.description,
		isPublic: true,
		favoritedCount: remote_clip.favoritedCount,
		isFavorited: false,
		notesCount: remote_clip.notesCount,
	});
}
