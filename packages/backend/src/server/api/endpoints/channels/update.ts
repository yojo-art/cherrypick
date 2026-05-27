/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as mfm from 'mfc-js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { DriveFilesRepository, ChannelsRepository, UsersRepository, NotesRepository, UserNotePiningsRepository, UserProfilesRepository, MiUser } from '@/models/_.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { NotePiningService } from '@/core/NotePiningService.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { HashtagService } from '@/core/HashtagService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	kind: 'write:channels',

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Channel',
	},

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'f9c5467f-d492-4c3c-9a8d-a70dacc86512',
		},

		accessDenied: {
			message: 'You do not have edit privilege of the channel.',
			code: 'ACCESS_DENIED',
			id: '1fb7cb09-d46a-4fdf-b8df-057788cce513',
		},

		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'e86c14a4-0da2-4032-8df3-e737a04c7f3b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 128 },
		description: { type: 'string', nullable: true, minLength: 1, maxLength: 2048 },
		bannerId: { type: 'string', format: 'misskey:id', nullable: true },
		isArchived: { type: 'boolean', nullable: true },
		pinnedNoteIds: {
			type: 'array',
			items: {
				type: 'string', format: 'misskey:id',
			},
		},
		color: { type: 'string', minLength: 1, maxLength: 16 },
		isSensitive: { type: 'boolean', nullable: true },
		allowRenoteToExternal: { type: 'boolean', nullable: true },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		@Inject(DI.userNotePiningsRepository)
		private userNotePiningsRepository: UserNotePiningsRepository,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private channelEntityService: ChannelEntityService,
		private notePiningService: NotePiningService,
		private globalEventService: GlobalEventService,
		private hashtagService: HashtagService,
		private driveFileEntityService: DriveFileEntityService,

		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({
				id: ps.channelId,
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			const iAmModerator = await this.roleService.isModerator(me);
			if (channel.userId !== me.id && !iAmModerator) {
				throw new ApiError(meta.errors.accessDenied);
			}
			const updates = {} as Partial<MiUser>;

			// eslint:disable-next-line:no-unnecessary-initializer
			let banner = undefined;
			if (ps.bannerId != null) {
				banner = await this.driveFilesRepository.findOneBy({ id: ps.bannerId });

				if (banner == null || banner.userId !== me.id) throw new ApiError(meta.errors.noSuchFile);

				if (!banner.type.startsWith('image/')) {
					banner = undefined;//画像以外が指定された時は変更なし
				}
			} else if (ps.bannerId === null) {
				banner = null;
			}
			if (channel.actorId) {
				if (ps.description !== undefined) {
					await this.userProfilesRepository.update({ userId: channel.actorId }, {
						description: ps.description,
					});
				}
				if (ps.pinnedNoteIds) {
					const old_notes = (await this.userNotePiningsRepository.find({
						where: { userId: channel.actorId },
						select: ['id'],
					})).map(x => x.id);
					const new_notes = (await this.notesRepository.createQueryBuilder('note').select(['id']).whereInIds(ps.pinnedNoteIds).getMany()).map(x => x.id);
					const add = new_notes.filter(x => !old_notes.includes(x));
					const remove = old_notes.filter(x => !new_notes.includes(x));
					for (const pin of remove) {
						await this.notePiningService.removePinned({ id: channel.actorId, host: channel.host }, pin);
					}
					for (const pin of add) {
						await this.notePiningService.addPinned({ id: channel.actorId, host: channel.host }, pin);
					}
					//ユーザーの方に設定した時はチャンネルテーブル側は消す
					ps.pinnedNoteIds = [];
				}
				if (banner) {
					updates.bannerId = banner.id;
					updates.bannerUrl = this.driveFileEntityService.getPublicUrl(banner);
					updates.bannerBlurhash = banner.blurhash;
				} else if (ps.bannerId === null) {
					updates.bannerId = null;
					updates.bannerUrl = null;
					updates.bannerBlurhash = null;
				}
				if (ps.name !== undefined || ps.description !== undefined) {
					const user = await this.usersRepository.findOneBy({ id: channel.actorId });
					if (ps.name !== undefined) {
						if (ps.name === user?.username) {
							updates.name = null;
						} else {
							const trimmedName = ps.name.trim();
							updates.name = trimmedName === '' ? null : trimmedName;
						}
					}
					let emojis = [] as string[];
					if (ps.name != null) {
						const tokens = mfm.parseSimple(ps.name);
						emojis = emojis.concat(extractCustomEmojisFromMfm(tokens));
					}
					let tags = [] as string[];
					if (ps.description != null) {
						const tokens = mfm.parse(ps.description);
						emojis = emojis.concat(extractCustomEmojisFromMfm(tokens));
						tags = extractHashtags(tokens).map(tag => normalizeForSearch(tag)).splice(0, 32);
					}

					updates.emojis = emojis;
					updates.tags = tags;

					// ハッシュタグ更新
					if (user) {
						this.hashtagService.updateUsertags(user, tags);
					}
				}
				if (Object.keys(updates).length > 0) {
					await this.usersRepository.update(channel.actorId, updates);
					this.globalEventService.publishInternalEvent('localUserUpdated', { id: channel.actorId });
				}
				//ユーザーの方に設定した時はチャンネルテーブルにはnullを入れる
				banner = null;
			}
			//nameとdescriptionはユーザーテーブルとチャンネルテーブル両方に入れる
			await this.channelsRepository.update(channel.id, {
				...(ps.name !== undefined ? { name: ps.name } : {}),
				...(ps.description !== undefined ? { description: ps.description } : {}),
				...(ps.pinnedNoteIds !== undefined ? { pinnedNoteIds: ps.pinnedNoteIds } : {}),
				...(ps.color !== undefined ? { color: ps.color } : {}),
				...(typeof ps.isArchived === 'boolean' ? { isArchived: ps.isArchived } : {}),
				...(banner !== undefined ? { bannerId: banner?.id ?? null } : {}),
				...(typeof ps.isSensitive === 'boolean' ? { isSensitive: ps.isSensitive } : {}),
				...(typeof ps.allowRenoteToExternal === 'boolean' ? { allowRenoteToExternal: ps.allowRenoteToExternal } : {}),
			});

			return await this.channelEntityService.pack(channel.id, me);
		});
	}
}
