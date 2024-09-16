/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { FindOptionsWhere } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import type { FlashsRepository, MiUser, UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type { Config } from '@/config.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { fetch_remote_api, fetch_remote_user_id } from '@/misc/remote-api-utils.js';

export const meta = {
	tags: ['users', 'flashs'],

	description: 'Show all flashs this user created.',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Flash',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.config)
		private config: Config,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,
		@Inject(DI.redisForRemoteApis)
		private redisForRemoteApis: Redis.Redis,

		private flashEntityService: FlashEntityService,
		private httpRequestService: HttpRequestService,
		private userEntityService: UserEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q: FindOptionsWhere<MiUser> = { id: ps.userId };

			const user = await this.usersRepository.findOneBy(q);
			if (user === null) return [];
			if (userEntityService.isRemoteUser(user)) {
				return remote(config, httpRequestService, redisForRemoteApis, userEntityService, user, ps.limit, ps.sinceId, ps.untilId);
			}
			const query = this.queryService.makePaginationQuery(this.flashsRepository.createQueryBuilder('flash'), ps.sinceId, ps.untilId)
				.andWhere('flash.userId = :userId', { userId: ps.userId })
				.andWhere('flash.visibility = \'public\'');

			const flashs = await query
				.limit(ps.limit)
				.getMany();

			return await this.flashEntityService.packMany(flashs);
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
	sinceId:string|undefined,
	untilId:string|undefined,
) {
	const cache_key = 'flash:user:' + user.id + '-' + sinceId + '-' + untilId;
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
		return [];
	}
	const remote_user_id = await fetch_remote_user_id(config, httpRequestService, redisForRemoteApis, user);
	if (remote_user_id === null) {
		return [];
	}
	const remote_json = await fetch_remote_api(config, httpRequestService, user.host, '/api/users/flashs', { userId: remote_user_id, limit, sinceId, untilId });
	const json = JSON.parse(remote_json);
	const flashs = [];
	for (const remote of json) {
		const flash = await awaitAll({
			id: remote.id + '@' + user.host,
			createdAt: remote.createdAt ? new Date(remote.createdAt).toISOString() : new Date(0).toISOString(),
			updatedAt: remote.updatedAt ? new Date(remote.updatedAt).toISOString() : new Date(0).toISOString(),
			userId: user.id,
			user: userEntityService.pack(user),
			title: String(remote.title),
			summary: String(remote.summary),
			script: String(remote.script),
			favoritedCount: remote.favoritedCount,
			visibility: remote.visibility ?? false,
			likedCount: remote.likedCount ?? 0,
			isLiked: false, //後でLike対応する
		});
		flashs.push(flash);
	}
	const redisPipeline = redisForRemoteApis.pipeline();
	redisPipeline.set(cache_key, JSON.stringify(flashs));
	redisPipeline.expire(cache_key, 10 * 60);
	await redisPipeline.exec();
	return flashs;
}
