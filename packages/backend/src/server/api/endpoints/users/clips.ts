/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import got, * as Got from 'got';
import type { ClipsRepository, MiUser, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { Config } from '@/config.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { FindOptionsWhere } from 'typeorm';

export const meta = {
	tags: ['users', 'clips'],

	description: 'Show all clips this user owns.',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Clip',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string' },
		untilId: { type: 'string' },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		@Inject(DI.redisForRemoteClips)
		private redisForRemoteClips: Redis.Redis,

		private httpRequestService: HttpRequestService,
		private userEntityService: UserEntityService,
		private clipEntityService: ClipEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q: FindOptionsWhere<MiUser> = { id: ps.userId };

			const user = await this.usersRepository.findOneBy(q);
			if (user === null) return [];
			if (userEntityService.isRemoteUser(user)) {
				return remote(config, httpRequestService, redisForRemoteClips, userEntityService, user, ps.limit, ps.sinceId, ps.untilId);
			}
			const query = this.queryService.makePaginationQuery(this.clipsRepository.createQueryBuilder('clip'), ps.sinceId, ps.untilId)
				.andWhere('clip.userId = :userId', { userId: ps.userId })
				.andWhere('clip.isPublic = true');

			const clips = await query
				.limit(ps.limit)
				.getMany();

			return await this.clipEntityService.packMany(clips, me);
		});
	}
}

async function remote(
	config:Config,
	httpRequestService: HttpRequestService,
	redisForRemoteClips: Redis.Redis,
	userEntityService: UserEntityService,
	user:MiUser,
	limit:number,
	sinceId:string|undefined,
	untilId:string|undefined,
) {
	const cache_key = user.id + '-' + sinceId + '-' + untilId + '-clips';
	const cache_value = await redisForRemoteClips.get(cache_key);
	if (cache_value !== null) {
		//ステータス格納
		if (cache_value.startsWith('__')) {
			if (cache_value === '__SKIP_FETCH') return [];
			//未定義のステータス
			return [];
		}
		return JSON.parse(cache_value);
	}
	if (user.host == null) {
		//ローカルユーザーではない
		return [];
	}
	const remote_user_id = await fetch_remote_user(config, httpRequestService, redisForRemoteClips, user.username, user.host);
	if (remote_user_id === null) {
		return [];
	}
	const remote_json = await fetch_remote_clip(config, httpRequestService, remote_user_id, user.host, limit, sinceId, untilId);
	const json = JSON.parse(remote_json);
	const clips = [];
	for (const remote_clip of json) {
		const clip = await awaitAll({
			id: remote_clip.id + '@' + user.host,
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
		clips.push(clip);
	}
	await redisForRemoteClips.set(cache_key, JSON.stringify(clips));
	await redisForRemoteClips.expire(cache_key, 10 * 60);
	return clips;
}

async function fetch_remote_user(
	config:Config,
	httpRequestService: HttpRequestService,
	redisForRemoteClips: Redis.Redis,
	username:string,
	host:string,
) {
	const cache_key = username + '@' + host + '-userid';
	const id = await redisForRemoteClips.get(cache_key);
	if (id !== null) {
		if (id === '__NOT_MISSKEY') {
			return null;
		}
		if (id === '__INTERVAL') {
			return null;
		}
		return id;
	}
	try {
		const url = 'https://' + host + '/api/users/show';
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
				username,
			}),
		});
		const text = await res.text();
		const json = JSON.parse(text);
		if (json.id != null) {
			redisForRemoteClips.set(cache_key, json.id);
			return json.id as string;
		}
	} catch {
		redisForRemoteClips.set(cache_key, '__INTERVAL');
		await redisForRemoteClips.expire(cache_key, 60 * 60);
	}
	return null;
}

async function fetch_remote_clip(
	config:Config,
	httpRequestService: HttpRequestService,
	userId:string,
	host:string,
	limit:number,
	sinceId:string|undefined,
	untilId:string|undefined,
) {
	const url = 'https://' + host + '/api/users/clips';
	const sinceIdRemote = sinceId ? sinceId.split('@')[0] : undefined;
	const untilIdRemote = untilId ? untilId.split('@')[0] : undefined;
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
			userId,
			limit,
			sinceId: sinceIdRemote,
			untilId: untilIdRemote,
		}),
	});
	return await res.text();
}
