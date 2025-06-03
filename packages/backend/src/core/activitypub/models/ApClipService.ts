/*
 * SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import promiseLimit from 'promise-limit';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import type Logger from '@/logger.js';
import type { MiRemoteUser, MiUser } from '@/models/User.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import type { ClipsRepository, UsersRepository } from '@/models/_.js';
import { toArray } from '@/misc/prelude/array.js';
import { IdService } from '@/core/IdService.js';
import { MfmService } from '@/core/MfmService.js';
import { MiClip } from '@/models/_.js';
import { ClipService } from '@/core/ClipService.js';
import { bindThis } from '@/decorators.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApResolverService, Resolver } from '../ApResolverService.js';
import { UserEntityService } from '../../entities/UserEntityService.js';
import { IObject, IOrderedCollectionPage, isIOrderedCollectionPage, type IClip } from '../type.js';
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
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

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

	@bindThis
	public async updateItems(clip: MiClip) {
		if (!clip.uri) throw new Error('no uri');
		this.logger.info(`Updating the clip: ${clip.uri}`);
		const user = await this.usersRepository.findOneByOrFail({ id: clip.userId });
		if (!this.userEntityService.isRemoteUser(user)) throw new Error('is not remote user');
		const resolver = this.apResolverService.createResolver();
		const ap_clip = await resolver.resolveClip(clip.uri);
		let next = ap_clip.first ?? null;
		const limit = 10;
		for (let i = 0; i < limit; i++) {
			if (!next) return;
			const ap_page = (typeof next === 'string' ? await resolver.resolve(next) : next) as IObject & { orderedItems?: IObject[], items?: IObject[] };
			const items = ap_page.orderedItems ?? ap_page.items;
			if (ap_page.type === 'PlayList' && items !== undefined) {
				//playlist
			} else if (isIOrderedCollectionPage(ap_page)) {
				next = ap_page.next;
			} else {
				throw new Error(`unrecognized collection type: ${ap_page.type}`);
			}
			const limit = promiseLimit<undefined>(2);
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
	@bindThis
	public async updateUserClips(userId: MiUser['id'], resolver?: Resolver): Promise<void> {
		const user = await this.usersRepository.findOneByOrFail({ id: userId });
		if (!this.userEntityService.isRemoteUser(user)) return;
		if (!user.clipsUri) return;

		this.logger.info(`Updating the Clips: ${user.uri}`);

		const _resolver = resolver ?? this.apResolverService.createResolver();

		// Resolve to (Ordered)Collection Object
		const yojoart_clips = await _resolver.resolveOrderedCollection(user.clipsUri);

		if (!yojoart_clips.first) throw new Error('_yojoart_clips first page not exist');
		//とりあえずfirstだけ取得する
		const next: string | IOrderedCollectionPage = yojoart_clips.first;
		const collection = (typeof(next) === 'string' ? await _resolver.resolveOrderedCollectionPage(next) : next);
		if (collection.partOf !== user.clipsUri) throw new Error('_yojoart_clips part is invalid');

		const activityes = (collection.orderedItems ?? collection.items);
		if (!activityes) throw new Error('item is unavailable');

		const limit = promiseLimit<IObject>(2);
		const items = await Promise.all(toArray(activityes).map(x => limit(async() => {
			return await _resolver.resolve(x);
		})));

		const clips : MiClip[] & { uri: string }[] = [];
		const id_map = new Map<string, MiClip>();

		let td = 0;
		for (const clip of items) {
			//衝突抑制
			td -= 1000;
			//uri必須
			if (!clip.id) continue;
			if (clip.type !== 'Clip' && clip.type !== 'Playlist') continue;
			if (new URL(clip.id).origin !== new URL(user.uri).origin) continue;
			//とりあえずpublicのみ対応
			if (!toArray(clip.to).includes('https://www.w3.org/ns/activitystreams#Public') && clip.to !== 'https://www.w3.org/ns/activitystreams#Public') {
				continue;
			}
			//作成時刻がわかる場合はそれを元にid生成
			const published = clip.published ? new Date(clip.published).getTime() : 0;
			const id_source = published > 0 ? published : Date.now() + td;
			let id = this.idService.gen(id_source);
			//id重複したら現在時刻を元に適当に生成
			if (id_map.has(id)) {
				id = this.idService.gen(Date.now() + td);
			}
			const miclip = {
				id,
				userId: user.id,
				name: clip.name ?? '',
				description: clip._misskey_summary ?? (clip.summary ? this.mfmService.fromHtml(clip.summary) : clip.content ? this.mfmService.fromHtml(clip.content) : null),
				uri: clip.id,
				lastClippedAt: clip.updated ? new Date(clip.updated) : null,
				user,
				isPublic: true,
				lastFetchedAt: new Date(0),
			};
			id_map.set(miclip.id, miclip);
			clips.push(miclip);
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
	@bindThis
	public async delete(actor: MiRemoteUser, uri: string) : Promise<string> {
		const clip = await this.clipsRepository.findOneBy({
			uri: uri,
			userId: actor.id,
		});
		if (clip) {
			try {
				await this.clipService.delete(actor, clip.id);
				return 'ok: delete clip ' + clip.id;
			} catch (e) {
				return 'error: clip delete ' + e;
			}
		} else {
			return 'skip: not found clip';
		}
	}

	@bindThis
	public async create(user: MiRemoteUser, clip: IClip) : Promise<string> {
		if (typeof clip.id !== 'string') return 'skip: id is not string';
		const isExists = await this.clipsRepository.existsBy({
			uri: clip.id,
			userId: clip.id,
		});
		if (isExists) return 'skip: clip already exists';
		const description = clip._misskey_summary ?? (clip.summary ? this.mfmService.fromHtml(clip.summary) : null);
		await this.clipService.create(user, clip.name ?? '', true, description, clip.id);
		return 'ok';
	}

	@bindThis
	public async update(actor: MiRemoteUser, object: IClip) : Promise<string> {
		const clip = await this.clipsRepository.findOneBy({
			uri: object.id,
			userId: actor.id,
		});

		if (clip) {
			try {
				this.clipsRepository.update(clip.id, {
					name: object.name ?? undefined,
					description: object._misskey_summary ?? (object.summary ? this.mfmService.fromHtml(object.summary) : undefined),
					lastFetchedAt: null,
				});
				return 'ok: delete clip ' + clip.id;
			} catch (e) {
				return 'error: clip delete ' + e;
			}
		} else {
			return 'skip not found clip';
		}
	}
}
