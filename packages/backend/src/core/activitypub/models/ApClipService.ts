/*
 * SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import promiseLimit from 'promise-limit';
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
import { ClipService } from '@/core/ClipService.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApResolverService, Resolver } from '../ApResolverService.js';
import { UserEntityService } from '../../entities/UserEntityService.js';
import { IOrderedCollectionPage, isOrderedCollection } from '../type.js';
import { ApNoteService } from './ApNoteService.js';

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
		private apNoteService: ApNoteService,
		private idService: IdService,
		private mfmService: MfmService,
		private apLoggerService: ApLoggerService,
		private clipService: ClipService,
	) {
		this.logger = this.apLoggerService.logger;
	}

	public async update(clip: MiClip) {
		if (!clip.uri) throw new Error('no uri');
		this.logger.info(`Updating the clip: ${clip.uri}`);
		const user = await this.usersRepository.findOneByOrFail({ id: clip.userId });
		if (!this.userEntityService.isRemoteUser(user)) throw new Error('is not remote user');
		const resolver = this.apResolverService.createResolver();
		const ap_clip = await resolver.resolveOrderedCollection(clip.uri);
		let next = ap_clip.first ?? null;
		const limit = 10;
		for (let i = 0; i < limit; i++) {
			if (!next) return;
			const ap_page = await resolver.resolveOrderedCollectionPage(next);
			next = ap_page.next;
			const limit = promiseLimit<undefined>(2);
			const items = ap_page.orderedItems ?? ap_page.items;
			if (Array.isArray(items)) {
				await Promise.all(items.map(item => limit(async() => {
					const note = await this.apNoteService.resolveNote(item, {
						resolver: resolver,
						sentFrom: new URL(user.uri),
					});
					if (note) {
						await this.clipService.addNote(user, clip.id, note.id);
					}
				})));
			}
		}
	}
	public async updateClips(userId: MiUser['id'], resolver?: Resolver): Promise<void> {
		const user = await this.usersRepository.findOneByOrFail({ id: userId });
		if (!this.userEntityService.isRemoteUser(user)) return;
		if (!user._yojoart_clips) return;

		this.logger.info(`Updating the Clips: ${user.uri}`);

		const _resolver = resolver ?? this.apResolverService.createResolver();

		// Resolve to (Ordered)Collection Object
		const yojoart_clips = await _resolver.resolveOrderedCollection(user._yojoart_clips);
		if (!isOrderedCollection(yojoart_clips)) throw new Error('Object is not Collection or OrderedCollection');

		if (!yojoart_clips.first) throw new Error('_yojoart_clips first page not exist');
		//とりあえずfirstだけ取得する
		const next: string | IOrderedCollectionPage = yojoart_clips.first;
		const collection = (typeof(next) === 'string' ? await _resolver.resolveOrderedCollectionPage(next) : next);
		if (collection.partOf !== user._yojoart_clips) throw new Error('_yojoart_clips part is invalid');

		const activityes = (collection.orderedItems ?? collection.items);
		if (!activityes) throw new Error('item is unavailable');

		const items = await Promise.all(toArray(activityes).map(x => _resolver.resolve(x)));

		const clips : MiClip[] & { uri: string }[] = [];

		let td = 0;
		for (const clip of items) {
			//衝突抑制
			td -= 1000;
			//uri必須
			if (!clip.id) continue;
			if (new URL(clip.id).origin !== new URL(user.uri).origin) continue;
			//とりあえずpublicのみ対応
			if (!toArray(clip.to).includes('https://www.w3.org/ns/activitystreams#Public') && clip.to !== 'https://www.w3.org/ns/activitystreams#Public') {
				continue;
			}
			//作成時刻がわかる場合はそれを元にid生成
			const id = clip.published ? new Date(clip.published).getTime() : Date.now() + td;
			clips.push({
				id: this.idService.gen(id),
				userId: user.id,
				name: clip.name ?? '',
				description: clip._misskey_summary ?? (clip.summary ? this.mfmService.fromHtml(clip.summary) : null),
				uri: clip.id,
				lastClippedAt: clip.updated ? new Date(clip.updated) : null,
				user,
				isPublic: true,
				lastFetchedAt: new Date(0),
			});
		}

		await this.db.transaction(async transactionalEntityManager => {
			const old_clips = await transactionalEntityManager.findBy(MiClip, { userId: user.id });
			const uri_map = new Map<string, MiClip>();
			for (const clip of old_clips) {
				if (clip.uri) {
					uri_map.set(clip.uri, clip);
				}
			};
			for (const clip of clips) {
				const find = uri_map.get(clip.uri);
				if (find) {
					//お気に入りが消えるのを回避するためにuriが一致した物をid変えずにupdateする
					uri_map.delete(clip.uri);
					if (
						find.description === clip.description &&
						find.name === clip.name &&
						find.lastClippedAt === clip.lastClippedAt
					) continue;
					await transactionalEntityManager.update(MiClip, { id: find.id }, {
						description: find.description !== clip.description ? clip.description : undefined,
						name: find.name !== clip.name ? clip.name : undefined,
						lastClippedAt: find.lastClippedAt !== clip.lastClippedAt ? clip.lastClippedAt : undefined,
						userId: find.userId !== user.id ? user.id : undefined,
						lastFetchedAt: find.lastClippedAt !== clip.lastClippedAt ? new Date(0) : undefined,
					});
				} else {
					//新規観測
					await transactionalEntityManager.insert(MiClip, clip);
				}
			}
			//元から認識してるクリップが無かったら消す
			for (const v of uri_map.values()) {
				await transactionalEntityManager.delete(MiClip, { id: v.id });
			}
			//await Promise.all(uri_map.values().map(v => transactionalEntityManager.delete(MiClip, { id: v.id })));
		});
	}
}
