/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { AnnouncementsRepository } from '@/models/_.js';
import { AnnouncementReactionService } from '@/core/AnnouncementReactionService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['reactions', 'announcements'],

	requireCredential: true,

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

			if (announcement == null) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			await this.announcementReactionService.create(me, announcement, ps.reaction).catch(err => {
				if (err.id === '0b0d5c9f-0c07-4f0e-8a3d-6f6a4a2b0a4f') throw new ApiError(meta.errors.alreadyReacted);
				throw err;
			});
		});
	}
}
