/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { AnnouncementsRepository, AnnouncementReadsRepository, MiAnnouncement, MiUser } from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { AnnouncementReactionService } from '@/core/AnnouncementReactionService.js';

@Injectable()
export class AnnouncementEntityService {
	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,

		@Inject(DI.announcementReadsRepository)
		private announcementReadsRepository: AnnouncementReadsRepository,

		private idService: IdService,
		private announcementReactionService: AnnouncementReactionService,
	) {
	}

	@bindThis
	public async pack(
		src: MiAnnouncement['id'] | MiAnnouncement & { isRead?: boolean | null },
		me?: { id: MiUser['id'] } | null | undefined,
		hint?: {
			reactions: Map<MiAnnouncement['id'], Record<string, number>>;
			myReactions: Map<MiAnnouncement['id'], string[]>;
		},
	): Promise<Packed<'Announcement'>> {
		const announcement = typeof src === 'object'
			? src
			: await this.announcementsRepository.findOneByOrFail({
				id: src,
			}) as MiAnnouncement & { isRead?: boolean | null };

		if (me && announcement.isRead === undefined) {
			announcement.isRead = await this.announcementReadsRepository
				.countBy({
					announcementId: announcement.id,
					userId: me.id,
				})
				.then((count: number) => count > 0);
		}

		const reactions = hint?.reactions.get(announcement.id)
			?? (await this.announcementReactionService.getCounts([announcement.id]))?.get(announcement.id)
			?? {};

		const myReactions = me
			? (hint?.myReactions ?? await this.announcementReactionService.getMyReactions([announcement.id], me.id))?.get(announcement.id) ?? []
			: [];

		return {
			id: announcement.id,
			createdAt: this.idService.parse(announcement.id).date.toISOString(),
			updatedAt: announcement.updatedAt?.toISOString() ?? null,
			title: announcement.title,
			text: announcement.text,
			imageUrl: announcement.imageUrl,
			icon: announcement.icon,
			display: announcement.display,
			forYou: announcement.userId === me?.id,
			needConfirmationToRead: announcement.needConfirmationToRead,
			silence: announcement.silence,
			isRead: announcement.isRead !== null ? announcement.isRead : undefined,
			reactionAcceptance: announcement.reactionAcceptance ?? null,
			reactions,
			myReactions,
		};
	}

	@bindThis
	public async packMany(
		announcements: (MiAnnouncement['id'] | MiAnnouncement & { isRead?: boolean | null } | MiAnnouncement)[],
		me?: { id: MiUser['id'] } | null | undefined,
	) : Promise<Packed<'Announcement'>[]> {
		// N+1 を避けるため、リアクションはまとめて取得してから pack に渡す
		const ids = announcements.map(x => typeof x === 'object' ? x.id : x);
		const reactions = await this.announcementReactionService.getCounts(ids)
			?? new Map<MiAnnouncement['id'], Record<string, number>>();
		const myReactions = (me
			? await this.announcementReactionService.getMyReactions(ids, me.id)
			: null) ?? new Map<MiAnnouncement['id'], string[]>();

		return (await Promise.allSettled(announcements.map(x => this.pack(x, me, { reactions, myReactions }))))
			.filter(result => result.status === 'fulfilled')
			.map(result => (result as PromiseFulfilledResult<Packed<'Announcement'>>).value);
	}
}
