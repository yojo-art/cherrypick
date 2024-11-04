/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
import { getApId, isIOrderedCollectionPage, isAnnounce, isNote, isPost } from '../type.js';
import { ApAudienceService } from '../ApAudienceService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { ApNoteService } from './ApNoteService.js';
import type { ApResolverService, Resolver } from '../ApResolverService.js';
import type { ApLoggerService } from '../ApLoggerService.js';

const pagelimit = 3;
const createLimit = 15;

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

		private noteEntityService: NoteEntityService,
		private noteCreateService: NoteCreateService,
		private appLockService: AppLockService,
		private apAudienceService: ApAudienceService,
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
		const user = await this.usersRepository.findOneByOrFail({ id: userId }) as MiRemoteUser;
		if (!user) throw new IdentifiableError('3fc5a089-cab4-48db-b9f3-f220574b3c0a', 'No such user');
		if (!user.host) throw new IdentifiableError('67070303-177c-4600-af93-b26a7ab889c6', 'Is local user');
		if (!user.outbox) throw new IdentifiableError('e7a2e510-a8ce-40e9-b1e6-c007bacdc89f', 'outbox undefined.');
		const outboxUrl = user.outbox;

		const meta = await this.metaService.fetch();
		if (this.utilityService.isBlockedHost(meta.blockedHosts, this.utilityService.extractDbHost(outboxUrl))) return;

		this.logger.info(`Fetcing the Outbox: ${outboxUrl}`);
		const Resolver = resolver ?? this.apResolverService.createResolver();

		// Resolve to (Ordered)Collection Object
		const outbox = await Resolver.resolveCollection(outboxUrl);

		if (outbox.type !== 'OrderedCollection') throw new IdentifiableError('0be2f5a1-2345-46d8-b8c3-430b111c68d3', 'outbox type is not OrderedCollection');
		if (!outbox.first) throw new IdentifiableError('a723c2df-0250-4091-b5fc-e3a7b36c7b61', 'outbox first page not exist');

		let nextUrl = outbox.first;
		let created = 0;

		for (let i = 0; i < pagelimit; i++) {
			const collectionPage = await Resolver.resolveOrderedCollectionPage(nextUrl);
			if (!isIOrderedCollectionPage(collectionPage)) throw new IdentifiableError('2a05bb06-f38c-4854-af6f-7fd5e87c98ee', 'Object is not collectionPage');

			if (collectionPage.orderedItems.length === 0) {
				break;
			}

			//IObject,IActivity型にないプロパティがあるのでany型にする
			const activityes = collectionPage.orderedItems as any[];
			created = await	this.fetchObjects(activityes, created, includeAnnounce, outboxUrl, user, Resolver);
			if (created > createLimit) break;
			nextUrl = collectionPage.next;
			if (!nextUrl) {
				break;
			}
		}
		this.logger.succ(`Outbox Fetced: ${outboxUrl}`);
		//this.logger.info(`Outbox Fetced last: ${nextUrl}`);
	}

	@bindThis
	private async fetchObjects(activityes: any[], created: number, includeAnnounce:boolean, outboxUrl: string, user:MiRemoteUser, resolver?: Resolver): Promise<number> {
		const Resolver = resolver ?? this.apResolverService.createResolver();
		const meta = await this.metaService.fetch();

		for (const activity of activityes) {
			if (created > createLimit) break;
			if (activity) {
				try {
					if (isAnnounce(activity)) {
						if (includeAnnounce === false) continue;
						const uri = getApId(activity);
						const announceLocal = await this.apNoteService.fetchNote(uri);
						if (announceLocal) continue;

						if (!activity.object) {
							this.apLoggerService.logger.info('skip: activity has no object property');
							continue;
						}
						//From ApInboxService.Announce
						//Announce対象
						const targetUri = getApId(activity.object);
						if (targetUri.startsWith('bear:')) {
							this.apLoggerService.logger.info('skip: bearcaps url not supported.');
							continue;
						}
						const target = await Resolver.resolve(activity.object);
						const unlock = await this.appLockService.getApLock(uri);
						try {
							if (isPost(target)) {
								if (this.utilityService.isBlockedHost(meta.blockedHosts, this.utilityService.extractDbHost(targetUri))) continue;
								try {
									let renote = await this.apNoteService.fetchNote(targetUri);
									if (renote === null) {
										renote = await this.apNoteService.createNote(targetUri, undefined, true);
										if (renote === null) {
											this.apLoggerService.logger.info('announce target is null');
											continue;
										}
									}
									this.logger.info(`Creating the (Re)Note: ${uri}`);

									const activityAudience = await this.apAudienceService.parseAudience(user, activity.to, activity.cc);
									const createdAt = activity.published ? new Date(activity.published) : null;

									if (createdAt && createdAt < this.idService.parse(renote.id).date) {
										this.apLoggerService.logger.info('skip: malformed createdAt');
										continue;
									}
									if (!await this.noteEntityService.isVisibleForMe(renote, user.id)) {
										this.apLoggerService.logger.info('skip: invalid actor for this activity');
										continue;
									}

									await this.noteCreateService.create(user, {
										createdAt,
										renote,
										visibility: activityAudience.visibility,
										searchableBy: null,
										visibleUsers: activityAudience.visibleUsers,
										uri,
									}, true );
									created++;
									continue;
								} catch (err) {
									// 対象が4xxならスキップ
									if (err instanceof StatusError) {
										if (!err.isRetryable) {
											this.apLoggerService.logger.info(`Ignored announce target ${target.id} - ${err.statusCode}`);
										}
										this.apLoggerService.logger.info(`Error in announce target ${target.id} - ${err.statusCode}`);
									}
									throw err;
								}
							} else {
								continue;
							}
						} finally {
							unlock();
						}
					} else if (isNote(activity.object)) {
						const id = getApId(activity.object);
						const local = await this.apNoteService.fetchNote(id);
						if (local) {
							continue;
						}
						await this.apNoteService.createNote(id, undefined, true);
						created++;
					} else {
						this.apLoggerService.logger.warn('Outbox activity type is not announce or create-note (type:' + activity.type + ')' );
					}
				} catch (err) {
					this.apLoggerService.logger.warn('Outbox activity fetch error:' + err );
					this.apLoggerService.logger.info(JSON.stringify(activity));
				}
			}
		}
		return created;
	}
}
