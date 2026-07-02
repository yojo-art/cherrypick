/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, FollowingsRepository } from '@/models/_.js';
import { MiChannel } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEvents, GlobalEventService } from '@/core/GlobalEventService.js';
import { bindThis } from '@/decorators.js';
import type { MiLocalUser, MiUser } from '@/models/User.js';
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
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		private idService: IdService,
		private globalEventService: GlobalEventService,
		private userEntityService: UserEntityService,
		private userFollowingService: UserFollowingService,
	) {
		this.userFollowingChannelsCache = new RedisKVCache<Set<string>>(this.redisClient, 'userFollowingChannels', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.followingsRepository.find({
				where: { followerId: key },
				select: ['followeeId'],
			}).then(xs => new Set(xs.map(x => x.followeeId))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value) => new Set(JSON.parse(value)),
		});

		this.redisForSub.on('message', this.onMessage);
	}

	onModuleInit() {
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
		if (this.userEntityService.isLocalUser(requestUser)) {
			this.globalEventService.publishInternalEvent('followChannel', {
				userId: requestUser.id,
				channelId: targetChannel.id,
			});
		}
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
		if (this.userEntityService.isLocalUser(requestUser)) {
			this.globalEventService.publishInternalEvent('unfollowChannel', {
				userId: requestUser.id,
				channelId: targetChannel.id,
			});
		}
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
