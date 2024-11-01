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
import { isIOrderedCollectionPage, isCreate, IOrderedCollectionPage, isNote } from '../type.js';
import { ApAudienceService } from '../ApAudienceService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { ApNoteService } from './ApNoteService.js';
import type { ApResolverService, Resolver } from '../ApResolverService.js';
import type { ApLoggerService } from '../ApLoggerService.js';

const pagelimit = 1;

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
		private apDbResolverService: ApDbResolverService,
		private noteEntityService: NoteEntityService,
		private noteCreateService: NoteCreateService,
		private appLockService: AppLockService,
		private apAudienceService: ApAudienceService,
		@Inject(DI.redis)
		private redisClient: Redis.Redis,
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
		// Resolve to (Ordered)Collection Object
		const outbox = cache ? await Resolver.resolveOrderedCollectionPage(cache) : await Resolver.resolveCollection(outboxUrl);

		if (!cache && outbox.type !== 'OrderedCollection') throw new IdentifiableError('0be2f5a1-2345-46d8-b8c3-430b111c68d3', 'outbox type is not OrderedCollection');
		if (!cache && !outbox.first) throw new IdentifiableError('a723c2df-0250-4091-b5fc-e3a7b36c7b61', 'outbox first page not exist');

		let nextUrl = cache ? (outbox as IOrderedCollectionPage).next : outbox.first;
		let page = 0;

		if (typeof(nextUrl) !== 'string') {
			const first = (nextUrl as any);
			if (first.partOf !== user.outbox) throw new IdentifiableError('6603433f-99db-4134-980c-48705ae57ab8', 'outbox part is invalid');

			const activityes = first.orderedItems ?? first.items;
			await this.fetchObjects(user, activityes, includeAnnounce);

			page = 1;
			if (!first.next) return;
		}

		for (; page < pagelimit; page++) {
			this.logger.info(nextUrl as string);
			const collectionPage = (typeof(nextUrl) === 'string' ? await Resolver.resolveOrderedCollectionPage(nextUrl) : nextUrl) as IOrderedCollectionPage;
			if (!isIOrderedCollectionPage(collectionPage)) throw new IdentifiableError('2a05bb06-f38c-4854-af6f-7fd5e87c98ee', 'Object is not collectionPage');
			if (collectionPage.partOf !== user.outbox) throw new IdentifiableError('6603433f-99db-4134-980c-48705ae57ab8', 'outbox part is invalid');
			nextUrl = collectionPage.next;

			const activityes = (collectionPage.orderedItems ?? collectionPage.items);
			if (!activityes) continue;
			await this.fetchObjects(user, activityes, includeAnnounce);

			if (!nextUrl) {
				break;
			}
			await this.redisClient.set(`${outboxUrl}--next`, `${nextUrl}`, 'EX', 60 * 15);//15min
		}
		this.logger.succ(`Outbox Fetced: ${outboxUrl}`);
		//this.logger.info(`Outbox Fetced last: ${nextUrl}`);
	}

	@bindThis
	private async fetchObjects(user: MiRemoteUser, activityes: any[], includeAnnounce:boolean) {
		for (const activity of activityes) {
			try {
				if (includeAnnounce && activity.type === 'Announce') {
					const object = await	this.apDbResolverService.getNoteFromApId(activity.id);

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
				} else if (isCreate(activity) && typeof(activity.object) !== 'string' && isNote(activity.object)) {
					const object = await	this.apDbResolverService.getNoteFromApId(activity.object);
					if (object) continue;
					await this.apNoteService.createNote(activity.object, undefined, true);
				}
			} catch (err) {
				if (err instanceof AbortError) {
					this.logger.warn(`Aborted note: ${activity.id}`);
				} else {
					this.logger.warn(JSON.stringify(err));
					this.logger.warn(JSON.stringify(activity));
					throw err;
				}
			}
		}
	}
}
