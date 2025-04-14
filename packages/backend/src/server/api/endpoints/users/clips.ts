/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type { ClipsRepository, MiUser, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { Config } from '@/config.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { emojis, fetch_remote_api, fetch_remote_user_id } from '@/misc/remote-api-utils.js';
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
		@Inject(DI.redisForRemoteApis)
		private redisForRemoteApis: Redis.Redis,

		private httpRequestService: HttpRequestService,
		private userEntityService: UserEntityService,
		private clipEntityService: ClipEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q: FindOptionsWhere<MiUser> = { id: ps.userId };

			const user = await this.usersRepository.findOneBy(q);
			if (user === null) return [];
			const query = this.queryService.makePaginationQuery(this.clipsRepository.createQueryBuilder('clip'), ps.sinceId, ps.untilId)
				.andWhere('clip.userId = :userId', { userId: ps.userId })
				.andWhere('clip.isPublic = true');

			const clips = await query
				.limit(ps.limit)
				.getMany();

			//DB叩いて無かったらリモートAPI
			if (userEntityService.isRemoteUser(user) && clips.length < 1) {
				return remote(config, httpRequestService, redisForRemoteApis, userEntityService, user, ps.limit, ps.sinceId, ps.untilId);
			}
			return await this.clipEntityService.packMany(clips, me);
		});
	}
}

async function remote(
	config:Config,
	httpRequestService: HttpRequestService,
	redisForRemoteApis: Redis.Redis,
	userEntityService: UserEntityService,
	user:MiUser,
	limit:number,
	sinceId:string | undefined,
	untilId:string | undefined,
) {
	const cache_key = 'clip:user:' + user.id + '-' + sinceId + '-' + untilId;
	const cache_value = await redisForRemoteApis.get(cache_key);
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
	const remote_user_id = await fetch_remote_user_id(config, httpRequestService, redisForRemoteApis, user);
	if (remote_user_id === null) {
		return [];
	}
	const remote_json = await fetch_remote_api(config, httpRequestService, user.host, '/api/users/clips', { userId: remote_user_id, limit, sinceId, untilId });
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
			emojis: remote_clip.description ? emojis(config, httpRequestService, redisForRemoteApis, user.host, remote_clip.description) : {},
		});
		clips.push(clip);
	}
	const redisPipeline = redisForRemoteApis.pipeline();
	redisPipeline.set(cache_key, JSON.stringify(clips));
	redisPipeline.expire(cache_key, 10 * 60);
	await redisPipeline.exec();
	return clips;
}
