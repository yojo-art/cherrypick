/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import got from 'got';
import * as Redis from 'ioredis';
import type { Config } from '@/config.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DI } from '@/di-symbols.js';
import type { ClipsRepository, MiNote, MiClip, ClipNotesRepository, NotesRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import type { MiUser } from '@/models/User.js';
import { Packed } from '@/misc/json-schema.js';
import { emojis } from '@/misc/remote-api-utils.js';
import { trackPromise } from '@/misc/promise-tracker.js';
import { AdvancedSearchService } from './AdvancedSearchService.js';
import { ApRendererService } from './activitypub/ApRendererService.js';
import { IActivity, ICreate } from './activitypub/type.js';
import { ApDeliverManagerService } from './activitypub/ApDeliverManagerService.js';

@Injectable()
export class ClipService {
	public static NoSuchNoteError = class extends Error {};
	public static NoSuchClipError = class extends Error {};
	public static AlreadyAddedError = class extends Error {};
	public static TooManyClipNotesError = class extends Error {};
	public static TooManyClipsError = class extends Error {};
	public static FailedToResolveRemoteUserError = class extends Error {};

	constructor(
		@Inject(DI.config)
		private config: Config,
		@Inject(DI.redisForRemoteApis)
		private redisForRemoteApis: Redis.Redis,
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		@Inject(DI.clipNotesRepository)
		private clipNotesRepository: ClipNotesRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private httpRequestService: HttpRequestService,
		private userEntityService: UserEntityService,
		private remoteUserResolveService: RemoteUserResolveService,
		private roleService: RoleService,
		private idService: IdService,
		private advancedSearchService: AdvancedSearchService,
		private apRendererService: ApRendererService,
		private apDeliverManagerService: ApDeliverManagerService,
	) {
	}

	@bindThis
	public async create(me: MiUser, name: string, isPublic: boolean, description: string | null, uri: string | null = null): Promise<MiClip> {
		const currentCount = await this.clipsRepository.countBy({
			userId: me.id,
		});
		if (currentCount >= (await this.roleService.getUserPolicies(me.id)).clipLimit) {
			throw new ClipService.TooManyClipsError();
		}

		const clip = await this.clipsRepository.insertOne({
			id: this.idService.gen(),
			userId: me.id,
			name: name,
			isPublic: isPublic,
			description: description,
			uri,
		});
		if (this.userEntityService.isLocalUser(me) && isPublic) {
			const activity: ICreate = {
				id: `${this.config.url}/clips/${clip.id}`,
				actor: this.userEntityService.genLocalUserUri(me.id),
				type: 'Create',
				published: this.idService.parse(clip.id).date.toISOString(),
				object: this.apRendererService.renderClip(clip),
				to: ['https://www.w3.org/ns/activitystreams#Public'],
				cc: [`${this.config.url}/users/${clip.userId}/followers`],
			};
			const createActivity = this.apRendererService.addContext(activity);
			const dm = this.apDeliverManagerService.createDeliverManager(me, createActivity);
			// フォロワーに配送
			dm.addFollowersRecipe();
			console.log('create Clip' + activity.id);
			//リレーはNoteしか対応しないだろう
			//this.relayService.deliverToRelays(me, createActivity);
			trackPromise(dm.execute());
		}
		return clip;
	}

	@bindThis
	public async update(me: MiUser, clipId: MiClip['id'], name: string | undefined, isPublic: boolean | undefined, description: string | null | undefined): Promise<void> {
		const clip = await this.clipsRepository.findOneBy({
			id: clipId,
			userId: me.id,
		});

		if (clip == null) {
			throw new ClipService.NoSuchClipError();
		}

		await this.clipsRepository.update(clip.id, {
			name: name,
			description: description,
			isPublic: isPublic,
		});
		const updated_clip = Object.assign(clip, {
			name,
			description,
			isPublic,
		}) as MiClip;
		if (this.userEntityService.isLocalUser(me)) {
			let activity: IActivity;
			if (updated_clip.isPublic !== clip.isPublic) {
				if (updated_clip.isPublic) {
					//公開に変更
					const createActivity: ICreate = {
						id: `${this.config.url}/clips/${clip.id}`,
						actor: this.userEntityService.genLocalUserUri(me.id),
						type: 'Create',
						published: this.idService.parse(clip.id).date.toISOString(),
						object: this.apRendererService.renderClip(clip),
						to: ['https://www.w3.org/ns/activitystreams#Public'],
						cc: [`${this.config.url}/users/${clip.userId}/followers`],
					};
					activity = createActivity;
				} else {
					//非公開に変更
					const tombstone = this.apRendererService.renderTombstone(`${this.config.url}/clips/${clip.id}`);
					tombstone.formerType = 'Clip';
					activity = this.apRendererService.renderDelete(tombstone, me);
				}
			} else {
				//公開設定に変更なし
				activity = this.apRendererService.renderUpdate(this.apRendererService.renderClip(updated_clip), me);
			}
			const dm = this.apDeliverManagerService.createDeliverManager(me, this.apRendererService.addContext(activity));
			// フォロワーに配送
			dm.addFollowersRecipe();
			trackPromise(dm.execute());
			console.log('update Clip ' + activity.type + ' ' + activity.id);
		}
	}

	@bindThis
	public async delete(me: MiUser, clipId: MiClip['id']): Promise<void> {
		const clip = await this.clipsRepository.findOneBy({
			id: clipId,
			userId: me.id,
		});

		if (clip == null) {
			throw new ClipService.NoSuchClipError();
		}

		await this.clipsRepository.delete(clip.id);
		await this.advancedSearchService.unindexUserClip(clip.id);
		if (this.userEntityService.isLocalUser(me) && clip.isPublic) {
			const tombstone = this.apRendererService.renderTombstone(`${this.config.url}/clips/${clip.id}`);
			tombstone.formerType = 'Clip';
			const activity = this.apRendererService.renderDelete(tombstone, me);
			const dm = this.apDeliverManagerService.createDeliverManager(me, this.apRendererService.addContext(activity));
			// フォロワーに配送
			dm.addFollowersRecipe();
			trackPromise(dm.execute());
			console.log('delete Clip' + activity.id);
		}
	}

	@bindThis
	public async addNote(me: MiUser, clipId: MiClip['id'], noteId: MiNote['id']): Promise<void> {
		const clip = await this.clipsRepository.findOneBy({
			id: clipId,
			userId: me.id,
		});

		if (clip == null) {
			throw new ClipService.NoSuchClipError();
		}

		const currentCount = await this.clipNotesRepository.countBy({
			clipId: clip.id,
		});
		if (currentCount >= (await this.roleService.getUserPolicies(me.id)).noteEachClipsLimit) {
			throw new ClipService.TooManyClipNotesError();
		}

		try {
			const ID = this.idService.gen();
			await this.clipNotesRepository.insert({
				id: ID,
				noteId: noteId,
				clipId: clip.id,
			});

			await this.advancedSearchService.indexFavorite(
				ID,
				{
					clipId: clip.id,
					noteId: noteId,
					userId: me.id,
				},
			);
		} catch (e: unknown) {
			if (e instanceof QueryFailedError) {
				if (isDuplicateKeyValueError(e)) {
					throw new ClipService.AlreadyAddedError();
				} else if (e.driverError.detail.includes('is not present in table "note".')) {
					throw new ClipService.NoSuchNoteError();
				}
			}

			throw e;
		}
		const lastClippedAt = new Date();
		this.clipsRepository.update(clip.id, {
			lastClippedAt,
		});

		this.notesRepository.increment({ id: noteId }, 'clippedCount', 1);
		if (this.userEntityService.isLocalUser(me) && clip.isPublic) {
			const updated_clip = {
				...clip,
				lastClippedAt,
			} as MiClip;
			const activity = this.apRendererService.renderUpdate(this.apRendererService.renderClip(updated_clip), me);
			const dm = this.apDeliverManagerService.createDeliverManager(me, this.apRendererService.addContext(activity));
			// フォロワーに配送
			dm.addFollowersRecipe();
			trackPromise(dm.execute());
		}
	}

	@bindThis
	public async removeNote(me: MiUser, clipId: MiClip['id'], noteId: MiNote['id']): Promise<void> {
		const clip = await this.clipsRepository.findOneBy({
			id: clipId,
			userId: me.id,
		});

		if (clip == null) {
			throw new ClipService.NoSuchClipError();
		}

		const note = await this.notesRepository.findOneBy({ id: noteId });

		if (note == null) {
			throw new ClipService.NoSuchNoteError();
		}

		await this.clipNotesRepository.delete({
			noteId: noteId,
			clipId: clip.id,
		});

		await this.advancedSearchService.unindexFavorite(undefined, noteId, clip.id, me.id);
		this.notesRepository.decrement({ id: noteId }, 'clippedCount', 1);
		if (this.userEntityService.isLocalUser(me) && clip.isPublic) {
			const activity = this.apRendererService.renderUpdate(this.apRendererService.renderClip(clip), me);
			const dm = this.apDeliverManagerService.createDeliverManager(me, this.apRendererService.addContext(activity));
			// フォロワーに配送
			dm.addFollowersRecipe();
			trackPromise(dm.execute());
		}
	}
	@bindThis
	async showRemoteOrDummy(clipId: string, author: MiUser | null) : Promise<Packed<'Clip'>> {
		if (author == null) {
			throw new Error();
		}
		try {
			if (author.host == null) {
				throw new Error();
			}
			return await this.showRemote(clipId, author.host);
		} catch {
			return await awaitAll({
				id: clipId + '@' + (author.host ?? ''),
				createdAt: new Date(0).toISOString(),
				lastClippedAt: new Date(0).toISOString(),
				userId: author.id,
				user: this.userEntityService.pack(author),
				name: 'Unavailable',
				description: '',
				isPublic: true,
				favoritedCount: 0,
				isFavorited: false,
				notesCount: 0,
			});
		}
	}
	@bindThis
	public async showRemote(
		clipId:string,
		host:string,
		fetch_emoji = false,
	) : Promise<Packed<'Clip'>> {
		const cache_key = 'clip:show:' + clipId + '@' + host;
		const cache_value = await this.redisForRemoteApis.get(cache_key);
		let remote_json = null;
		if (cache_value === null) {
			const timeout = 30 * 1000;
			const operationTimeout = 60 * 1000;
			const url = 'https://' + host + '/api/clips/show';
			const res = got.post(url, {
				headers: {
					'User-Agent': this.config.userAgent,
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
					http: this.httpRequestService.httpAgent,
					https: this.httpRequestService.httpsAgent,
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
			const redisPipeline = this.redisForRemoteApis.pipeline();
			redisPipeline.set(cache_key, remote_json);
			redisPipeline.expire(cache_key, 10 * 60);
			await redisPipeline.exec();
		} else {
			remote_json = cache_value;
		}
		const remote_clip = JSON.parse(remote_json);
		if (remote_clip.user == null || remote_clip.user.username == null) {
			throw new ClipService.FailedToResolveRemoteUserError();
		}
		const user = await this.remoteUserResolveService.resolveUser(remote_clip.user.username, host).catch(() => {
			throw new ClipService.FailedToResolveRemoteUserError();
		});
		return await awaitAll({
			id: clipId + '@' + host,
			createdAt: remote_clip.createdAt ? remote_clip.createdAt : null,
			lastClippedAt: remote_clip.lastClippedAt ? remote_clip.lastClippedAt : null,
			userId: user.id,
			user: this.userEntityService.pack(user),
			name: remote_clip.name,
			description: remote_clip.description,
			isPublic: true,
			favoritedCount: remote_clip.favoritedCount,
			isFavorited: false,
			notesCount: remote_clip.notesCount,
			emojis: (remote_clip.description && fetch_emoji) ? emojis(this.config, this.httpRequestService, this.redisForRemoteApis, host, remote_clip.description) : {},
		});
	}
}
