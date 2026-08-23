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
			id: '0519b30e-f105-4324-9274-16f87f5e1ae6',
		},

		notReacted: {
			message: 'You are not reacting to that announcement.',
			code: 'NOT_REACTED',
			id: '899123f8-6e9c-4ff1-b5f7-198657e9609a',
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
			});

			if (announcement == null) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			await this.announcementReactionService.delete(me, announcement, ps.reaction).catch(err => {
				if (err.id === '9f2b4d1e-3c8a-4b6f-9d0e-7a1c5b8e2f30') throw new ApiError(meta.errors.notReacted);
				throw err;
			});
		});
	}
}
