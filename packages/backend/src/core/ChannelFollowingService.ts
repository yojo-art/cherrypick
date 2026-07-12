/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, FollowingsRepository, ChannelsRepository, MiUser } from '@/models/_.js';
import { MiChannel } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEvents, GlobalEventService } from '@/core/GlobalEventService.js';
import { bindThis } from '@/decorators.js';
import { RedisKVCache } from '@/misc/cache.js';
import { UserEntityService } from './entities/UserEntityService.js';
import { UserFollowingService } from './UserFollowingService.js';

@Injectable()
export class ChannelFollowingService implements OnModuleInit {
	public userFollowingChannelsCache: RedisKVCache<Set<string>>;

	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,
		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private globalEventService: GlobalEventService,
		private userEntityService: UserEntityService,
		private userFollowingService: UserFollowingService,
	) {
		this.userFollowingChannelsCache = new RedisKVCache<Set<string>>(this.redisClient, 'userFollowingChannels', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.followingsRepository.createQueryBuilder('following')
				.innerJoinAndSelect('following.followee', 'followee')
				.select(['followee.channelId', 'following.followeeId'])
				.where('following.followerId = :followerId', { followerId: key })
				.andWhere('followee.channelId IS NOT NULL')
				.getMany().then(xs => new Set(xs.map(x => x.followee?.channelId).filter(x => x != null))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value) => new Set(JSON.parse(value)),
		});

		this.redisForSub.on('message', this.onMessage);
	}

	onModuleInit() {
	}

	/**
	 * フォローしているチャンネルの一覧を取得する.
	 * @param params
	 * @param [opts]
	 * @param	{(boolean|undefined)} [opts.idOnly=false] チャンネルIDのみを取得するかどうか. ID以外のフィールドに値がセットされなくなり、他テーブルとのJOINも一切されなくなるので注意.
	 * @param {(boolean|undefined)} [opts.joinUser=undefined] チャンネルオーナーのユーザ情報をJOINするかどうか(falseまたは省略時はJOINしない).
	 * @param {(boolean|undefined)} [opts.joinBannerFile=undefined] バナー画像のドライブファイルをJOINするかどうか(falseまたは省略時はJOINしない).
	 */
	@bindThis
	public async list(
		params: {
			requestUserId: MiUser['id'],
		},
		opts?: {
			idOnly?: boolean;
			joinUser?: boolean;
			joinBannerFile?: boolean;
		},
	): Promise<MiChannel[]> {
		if (opts?.idOnly) {
			return this.userFollowingChannelsCache.get(params.requestUserId).then(xs => {
				return xs ? xs.values().toArray().map(x => ({ id: x } as MiChannel)) : [];
			});
		} else {
			const q = this.channelsRepository.createQueryBuilder('channel')
				.innerJoin('following', 'following', 'following.followeeId = channel.id')
				.where('following.followerId = :userId', { userId: params.requestUserId });

			if (opts?.joinUser) {
				q.innerJoinAndSelect('channel.user', 'user');
			}

			if (opts?.joinBannerFile) {
				q.leftJoinAndSelect('channel.banner', 'drive_file');
			}

			return q.getMany();
		}
	}

	@bindThis
	public async follow(
		requestUser: MiUser,
		targetChannel: MiChannel,
	): Promise<void> {
		if (!targetChannel.actorId) {
			return;
		}
		targetChannel.actor ??= await this.usersRepository.findOneBy({ id: targetChannel.actorId });
		if (targetChannel.actor == null) {
			return;
		}
		await this.userFollowingService.follow(requestUser, targetChannel.actor);
	}

	@bindThis
	public async unfollow(
		requestUser: MiUser,
		targetChannel: MiChannel,
	): Promise<void> {
		if (!targetChannel.actorId) {
			return;
		}
		targetChannel.actor ??= await this.usersRepository.findOneBy({ id: targetChannel.actorId });
		if (targetChannel.actor == null) {
			return;
		}
		await this.userFollowingService.unfollow(requestUser, targetChannel.actor);
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } = obj.message as GlobalEvents['internal']['payload'];
			switch (type) {
				case 'followChannel': {
					this.userFollowingChannelsCache.refresh(body.userId);
					break;
				}
				case 'unfollowChannel': {
					this.userFollowingChannelsCache.delete(body.userId);
					break;
				}
			}
		}
	}

	@bindThis
	public dispose(): void {
		this.userFollowingChannelsCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
