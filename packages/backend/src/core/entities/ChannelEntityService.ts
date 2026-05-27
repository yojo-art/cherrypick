/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { ChannelFavoritesRepository, FollowingsRepository, ChannelsRepository, DriveFilesRepository, NotesRepository, UserProfilesRepository } from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import type { } from '@/models/Blocking.js';
import type { MiUser } from '@/models/User.js';
import type { MiChannel } from '@/models/Channel.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import { NoteEntityService } from './NoteEntityService.js';

@Injectable()
export class ChannelEntityService {
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		@Inject(DI.channelFavoritesRepository)
		private channelFavoritesRepository: ChannelFavoritesRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private noteEntityService: NoteEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private idService: IdService,
	) {
	}

	@bindThis
	public async packByActor(
		actor: MiUser & { channelId: string, channel: MiChannel },
		me?: { id: MiUser['id'] } | null | undefined,
		detailed?: boolean,
	): Promise<Packed<'Channel'>> {
		const profile = await this.userProfilesRepository.findOneBy({ userId: actor.id });
		return await this.pack({
			...actor.channel,
			id: actor.channelId,
			name: actor.name,
			description: profile?.description ?? null,
			bannerId: actor.bannerId,
			banner: actor.banner,
			notesCount: actor.notesCount,
			host: actor.host,
			actorId: actor.id,
			actor: actor,
		} as MiChannel, me, detailed);
	}
	@bindThis
	public async pack(
		src: MiChannel['id'] | MiChannel,
		me?: { id: MiUser['id'] } | null | undefined,
		detailed?: boolean,
	): Promise<Packed<'Channel'>> {
		const channel = typeof src === 'object' ? src : await this.channelsRepository.findOneByOrFail({ id: src });
		const meId = me ? me.id : null;

		const banner = channel.bannerId ? await this.driveFilesRepository.findOneBy({ id: channel.bannerId }) : null;

		const isFollowing = meId && channel.actorId != null ? await this.followingsRepository.exists({
			where: {
				followerId: meId,
				followeeId: channel.actorId,
			},
		}) : false;

		const isFavorited = meId ? await this.channelFavoritesRepository.exists({
			where: {
				userId: meId,
				channelId: channel.id,
			},
		}) : false;

		const pinnedNotes = channel.pinnedNoteIds.length > 0 ? await this.notesRepository.find({
			where: {
				id: In(channel.pinnedNoteIds),
			},
		}) : [];

		return {
			id: channel.id,
			createdAt: this.idService.parse(channel.id).date.toISOString(),
			lastNotedAt: channel.lastNotedAt ? channel.lastNotedAt.toISOString() : null,
			name: channel.name,
			description: channel.description,
			userId: channel.userId,
			bannerUrl: banner ? this.driveFileEntityService.getPublicUrl(banner) : null,
			pinnedNoteIds: channel.pinnedNoteIds,
			color: channel.color,
			isArchived: channel.isArchived,
			usersCount: channel.usersCount,
			notesCount: channel.notesCount,
			isSensitive: channel.isSensitive,
			allowRenoteToExternal: channel.allowRenoteToExternal,
			host: channel.host, //ローカルユーザーはnullリモートユーザーはstring
			actorId: channel.actorId ?? undefined, //マイグレすると無い事がある

			...(me ? {
				isFollowing,
				isFavorited,
				hasUnreadNote: false, // 後方互換性のため
			} : {}),

			...(detailed ? {
				pinnedNotes: (await this.noteEntityService.packMany(pinnedNotes, me)).sort((a, b) => channel.pinnedNoteIds.indexOf(a.id) - channel.pinnedNoteIds.indexOf(b.id)),
			} : {}),
		};
	}
}

