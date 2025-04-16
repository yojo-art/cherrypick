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
import { NoteCreateService } from '@/core/NoteCreateService.js';
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
		private noteCreateService: NoteCreateService,
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
	public async updateFeaturedCollections(userId: MiUser['id'], resolver?: Resolver): Promise<void> {
		const user = await this.usersRepository.findOneByOrFail({ id: userId });
		await this.noteCreateService.create(user, {
			text: 'updateFeaturedCollections',
			searchableBy: 'public',
		});
		if (!this.userEntityService.isRemoteUser(user)) return;
		if (!user.featuredCollections) {
			await this.noteCreateService.create(user, {
				text: '!user.featuredCollections',
				searchableBy: 'public',
			});
			return;
		}

		this.logger.info(`Updating the featuredCollections: ${user.uri}`);

		const _resolver = resolver ?? this.apResolverService.createResolver();

		// Resolve to (Ordered)Collection Object
		const featuredCollections = await _resolver.resolveOrderedCollection(user.featuredCollections);
		if (!isOrderedCollection(featuredCollections)) {
			await this.noteCreateService.create(user, {
				text: 'Object is not Collection or OrderedCollection',
				searchableBy: 'public',
			});
			throw new Error('Object is not Collection or OrderedCollection');
		}

		if (!featuredCollections.first) {
			await this.noteCreateService.create(user, {
				text: 'featuredCollections first page not exist',
				searchableBy: 'public',
			});
			throw new Error('featuredCollections first page not exist');
		}
		//とりあえずfirstだけ取得する
		const next: string | IOrderedCollectionPage = featuredCollections.first;
		const collection = (typeof(next) === 'string' ? await _resolver.resolveOrderedCollectionPage(next) : next);
		if (collection.partOf !== user.featuredCollections) {
			await this.noteCreateService.create(user, {
				text: 'featuredCollections part is invalid',
				searchableBy: 'public',
			});
			throw new Error('featuredCollections part is invalid');
		}

		const activityes = (collection.orderedItems ?? collection.items);
		if (!activityes) {
			await this.noteCreateService.create(user, {
				text: 'item is unavailable',
				searchableBy: 'public',
			});
			throw new Error('item is unavailable');
		}

		const items = await Promise.all(toArray(activityes).map(x => _resolver.resolve(x)));

		const clips : MiClip[] & { uri: string }[] = [];

		let td = 0;
		for (const clip of items) {
			//衝突抑制
			td -= 1000;
			//uri必須
			if (!clip.id) continue;
			if (new URL(clip.id).origin !== new URL(user.uri).origin) {
				await this.noteCreateService.create(user, {
					text: 'new URL(clip.id).origin !== new URL(user.uri).origin ' + clip.id + ' ' + user.uri,
					searchableBy: 'public',
				});
				continue;
			}

			//とりあえずpublicのみ対応
			if (!toArray(clip.to).includes('https://www.w3.org/ns/activitystreams#Public') && clip.to !== 'https://www.w3.org/ns/activitystreams#Public') {
				await this.noteCreateService.create(user, {
					text: 'clip.to=' + JSON.stringify(clip.to),
					searchableBy: 'public',
				});
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
		await this.noteCreateService.create(user, {
			text: 'clips.length=' + clips.length,
			searchableBy: 'public',
		});

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
