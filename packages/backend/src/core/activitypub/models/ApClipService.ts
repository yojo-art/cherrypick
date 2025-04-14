/*
 * SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import type Logger from '@/logger.js';
import type { MiUser } from '@/models/User.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository } from '@/models/_.js';
import { toArray } from '@/misc/prelude/array.js';
import { IdService } from '@/core/IdService.js';
import { MfmService } from '@/core/MfmService.js';
import { MiClip } from '@/models/_.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApResolverService, Resolver } from '../ApResolverService.js';
import { UserEntityService } from '../../entities/UserEntityService.js';
import { IOrderedCollectionPage, isOrderedCollection } from '../type.js';

@Injectable()
export class ApClipService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private apResolverService: ApResolverService,
		private userEntityService: UserEntityService,
		private idService: IdService,
		private mfmService: MfmService,
		private apLoggerService: ApLoggerService,
	) {
		this.logger = this.apLoggerService.logger;
	}

	public async updateFeaturedCollections(userId: MiUser['id'], resolver?: Resolver): Promise<void> {
		const user = await this.usersRepository.findOneByOrFail({ id: userId });
		if (!this.userEntityService.isRemoteUser(user)) return;
		if (!user.featuredCollections) return;

		this.logger.info(`Updating the featuredCollections: ${user.uri}`);

		const _resolver = resolver ?? this.apResolverService.createResolver();

		// Resolve to (Ordered)Collection Object
		const featuredCollections = await _resolver.resolveOrderedCollection(user.featuredCollections);
		if (!isOrderedCollection(featuredCollections)) throw new Error('Object is not Collection or OrderedCollection');

		if (!featuredCollections.first) throw new Error('featuredCollections first page not exist');
		//とりあえずfirstだけ取得する
		const next: string | IOrderedCollectionPage = featuredCollections.first;
		const collection = (typeof(next) === 'string' ? await _resolver.resolveOrderedCollectionPage(next) : next);
		if (collection.partOf !== user.featuredCollections) throw new Error('featuredCollections part is invalid');

		const activityes = (collection.orderedItems ?? collection.items);
		if (!activityes) throw new Error('item is unavailable');

		const items = await Promise.all(toArray(activityes).map(x => _resolver.resolve(x)));

		const clips:MiClip[] = [];

		let td = 0;
		for (const clip of items) {
			//衝突抑制
			td -= 1000;
			//uri必須
			if (!clip.id) continue;
			//とりあえずpublicのみ対応
			if (!toArray(clip.to).includes('https://www.w3.org/ns/activitystreams#Public') && clip.to !== 'https://www.w3.org/ns/activitystreams#Public') {
				continue;
			}
			//作成時刻がわかる場合はそれを元にid生成
			const id = clip.published ? new Date(clip.published).getTime() : Date.now() + td;
			clips.push({
				id: this.idService.gen(id),
				userId: user.id,
				description: clip._misskey_summary ?? (clip.summary ? this.mfmService.fromHtml(clip.summary) : null),
				uri: clip.id,
				lastClippedAt: clip.updated ? new Date(clip.updated) : null,
				user,
				name: clip.name ?? '',
				isPublic: true,
				lastFetchedAt: new Date(0),
			});
		}

		await this.db.transaction(async transactionalEntityManager => {
			await transactionalEntityManager.delete(MiClip, { userId: user.id });
			await transactionalEntityManager.insert(MiClip, clips);
		});
	}
}
