/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as Redis from 'ioredis';
import { AbortError } from 'got';
import { DI } from '@/di-symbols.js';
import type { UsersRepository } from '@/models/_.js';
import type { MiRemoteUser } from '@/models/User.js';
import { MiUser } from '@/models/User.js';
import type Logger from '@/logger.js';
import type { IdService } from '@/core/IdService.js';
import { StatusError } from '@/misc/status-error.js';
import type { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { MetaService } from '@/core/MetaService.js';
import { AppLockService } from '@/core/AppLockService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApDbResolverService } from '@/core/activitypub/ApDbResolverService.js';
import { isCreate, IOrderedCollectionPage, isNote } from '../type.js';
import { ApAudienceService } from '../ApAudienceService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { ApNoteService } from './ApNoteService.js';
import type { ApResolverService, Resolver } from '../ApResolverService.js';
import type { ApLoggerService } from '../ApLoggerService.js';

const pagelimit = 1;
const createLimit = 20;
@Injectable()
export class ApOutboxFetchService implements OnModuleInit {
	private utilityService: UtilityService;
	private idService: IdService;
	private metaService: MetaService;
	private apResolverService: ApResolverService;
	private apNoteService: ApNoteService;
	private apLoggerService: ApLoggerService;
	private logger: Logger;

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private apAudienceService: ApAudienceService,
		private apDbResolverService: ApDbResolverService,
		private appLockService: AppLockService,
		private noteCreateService: NoteCreateService,
		private noteEntityService: NoteEntityService,
	) {
	}

	onModuleInit(): void {
		this.utilityService = this.moduleRef.get('UtilityService');
		this.idService = this.moduleRef.get('IdService');
		this.metaService = this.moduleRef.get('MetaService');
		this.apResolverService = this.moduleRef.get('ApResolverService');
		this.apNoteService = this.moduleRef.get('ApNoteService');
		this.apLoggerService = this.moduleRef.get('ApLoggerService');
		this.logger = this.apLoggerService.logger;
	}

	/**
	 * outboxから投稿を取得します
	 */
	@bindThis
	public async fetchOutbox(userId: MiUser['id'], includeAnnounce = false, resolver?: Resolver): Promise<void> {
		const user = (await this.usersRepository.findOneBy({ id: userId }) as MiRemoteUser | null) ?? null;
		if (!user) throw new IdentifiableError('3fc5a089-cab4-48db-b9f3-f220574b3c0a', 'No such user');
		if (!user.host) throw new IdentifiableError('67070303-177c-4600-af93-b26a7ab889c6', 'Is local user');
		if (!user.outbox) throw new IdentifiableError('e7a2e510-a8ce-40e9-b1e6-c007bacdc89f', 'outbox undefined.');
		const blockedHosts = (await this.metaService.fetch()).blockedHosts;
		if (this.utilityService.isBlockedHost(blockedHosts, user.host)) throw new IdentifiableError('b27090c8-8a68-4189-a445-14591c32a89c', 'blocked instance.');
		const outboxUrl = user.outbox;

		this.logger.info(`Fetcing the Outbox: ${outboxUrl}`);
		const Resolver = resolver ?? this.apResolverService.createResolver();
		const cache = await this.redisClient.get(`${outboxUrl}--next`);
		let next: string | IOrderedCollectionPage;

		if (!cache) {
			// Resolve to (Ordered)Collection Object
			const outbox = await Resolver.resolveOrderedCollection(outboxUrl);
			if (!outbox.first) throw new IdentifiableError('a723c2df-0250-4091-b5fc-e3a7b36c7b61', 'outbox first page not exist');
			next = outbox.first;
		} else next = cache;

		let created = 0;

		for (let page = 0; page < pagelimit; page++) {
			const collection = (typeof(next) === 'string' ? await Resolver.resolveOrderedCollectionPage(next) : next);
			if (collection.partOf !== user.outbox) throw new IdentifiableError('6603433f-99db-4134-980c-48705ae57ab8', 'outbox part is invalid');

			const activityes = (collection.orderedItems ?? collection.items);
			if (!activityes) throw new IdentifiableError('2a05bb06-f38c-4854-af6f-7fd5e87c98ee', 'item is undefined');

			created = await this.fetchObjects(user, activityes, includeAnnounce, created);
			if (createLimit <= created) break;//次ページ見て一件だけしか取れないのは微妙
			if (!collection.next) break;

			await this.redisClient.set(`${outboxUrl}--next`, `${collection.next}`, 'EX', 60 * 15);//15min
		}
		this.logger.succ(`Outbox Fetced: ${outboxUrl}`);
	}

	@bindThis
	private async fetchObjects(user: MiRemoteUser, activityes: any[], includeAnnounce:boolean, created: number): Promise<number> {
		for (const activity of activityes) {
			if (createLimit < created) return created;
			try {
				if (activity.actor !== user.uri) throw new IdentifiableError('bde7c204-5441-4a87-9b7e-f81e8d05788a');
				if (activity.type === 'Announce' && includeAnnounce) {
					const object = await this.apNoteService.fetchNote(activity.id);

					if (object) continue;

					//ブロックしてたら取得しない
					const blockedHosts = (await this.metaService.fetch()).blockedHosts;
					if (typeof(activity.object) === 'string') {
						if (this.utilityService.isBlockedHost(blockedHosts, this.utilityService.toPuny(new URL(activity.object).hostname))) continue;
					} else {
						if (this.utilityService.isBlockedHost(blockedHosts, this.utilityService.toPuny(new URL(activity.object.id).hostname))) continue;
					}

					const unlock = await this.appLockService.getApLock(activity.id);
					try {
						if (!activity.id) continue;
						let renote = await this.apNoteService.fetchNote(activity.object);
						if (renote === null) {
							renote = await this.apNoteService.createNote(activity.object, undefined, true);
							if (renote === null) {
								this.logger.info('announce target is null');
								continue;
							}
						}
						this.logger.info(`Creating the (Re)Note: ${activity.id}`);

						const activityAudience = await this.apAudienceService.parseAudience(user, activity.to, activity.cc);
						const createdAt = activity.published ? new Date(activity.published) : null;

						if (createdAt && createdAt < this.idService.parse(renote.id).date) {
							this.logger.info('skip: malformed createdAt');
							continue;
						}
						if (!await this.noteEntityService.isVisibleForMe(renote, user.id)) {
							this.logger.info('skip: invalid actor for this activity');
							continue;
						}
						await this.noteCreateService.create(user, {
							createdAt,
							renote,
							searchableBy: null,
							visibility: activityAudience.visibility,
							visibleUsers: activityAudience.visibleUsers,
							uri: activity.id,
						}, true );
					} catch (err) {
					// 対象が4xxならスキップ
						if (err instanceof StatusError) {
							if (!err.isRetryable) {
								this.logger.info(`Ignored announce target ${activity.object} - ${err.statusCode}`);
							}
							this.logger.info(`Error in announce target ${activity.object} - ${err.statusCode}`);
						} else {
							throw err;
						}
					} finally {
						unlock();
					}
				} else if (isCreate(activity)) {
					if (typeof(activity.object) !== 'string') {
						if (!isNote(activity)) throw new IdentifiableError('9e344117-8392-402d-9f5a-d1cc20ba63cc');
					}
					const fetch = await this.apNoteService.fetchNote(activity.object);
					if (fetch) continue;
					await this.apNoteService.createNote(activity.object, undefined, true);
				}
			} catch (err) {
				//リモートのリモートが落ちてるなどで止まるとほかが見れなくなってしまうので再スローしない
				if (err instanceof IdentifiableError) {
					if (err.id === 'bde7c204-5441-4a87-9b7e-f81e8d05788a') this.logger.error(`fetchErrorInvalidActor:${activity.id}`);
					if (err.id === '9e344117-8392-402d-9f5a-d1cc20ba63cc') this.logger.error(`fetchErrorNotNote:${activity.id}`);
				} else {
					this.logger.error(`fetchError:${activity.id}`);
					this.logger.error(`${err}`);
					continue;
				}
			}
			created ++;
		}
		return created;
	}
}
