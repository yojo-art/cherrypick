/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { AnnouncementsRepository } from '@/models/_.js';
import { AnnouncementReactionService, AnnouncementReactionErrorIds } from '@/core/AnnouncementReactionService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['reactions', 'announcements'],

	requireCredential: true,

	limit: {
		duration: ms('1hour'),
		max: 60,
		minInterval: ms('3sec'),
	},

	prohibitMoved: true,

	kind: 'write:reactions',

	errors: {
		noSuchAnnouncement: {
			message: 'No such announcement.',
			code: 'NO_SUCH_ANNOUNCEMENT',
			id: '8cd3a0bb-4a35-47d7-9d4f-965bd3156879',
		},

		alreadyReacted: {
			message: 'You are already reacting to that announcement.',
			code: 'ALREADY_REACTED',
			id: '18aca5e1-b265-47b2-b40a-6cc0958fdeab',
		},

		reactionsNotAllowed: {
			message: 'Reactions are not allowed for this announcement.',
			code: 'REACTIONS_NOT_ALLOWED',
			id: '5dc6d2af-e34c-4cdf-9303-1875fa390d02',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		announcementId: { type: 'string', format: 'misskey:id' },
		reaction: { type: 'string' },
	},
	required: ['announcementId', 'reaction'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,

		private announcementReactionService: AnnouncementReactionService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const announcement = await this.announcementsRepository.findOneBy({
				id: ps.announcementId,
				isActive: true,
			});

			if (announcement == null || (announcement.userId != null && announcement.userId !== me.id)) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			await this.announcementReactionService.create(me, announcement, ps.reaction).catch(err => {
				if (err.id === AnnouncementReactionErrorIds.alreadyReacted) throw new ApiError(meta.errors.alreadyReacted);
				if (err.id === AnnouncementReactionErrorIds.reactionsNotAllowed) throw new ApiError(meta.errors.reactionsNotAllowed);
				throw err;
			});
		});
	}
}
