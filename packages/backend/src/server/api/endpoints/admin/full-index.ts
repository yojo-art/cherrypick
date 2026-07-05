/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, TeamNijimiss(@nafu-at), yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { AdvancedSearchService } from '@/core/AdvancedSearchService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:reindex',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		index: {
			type: 'string',
			enum: ['notes', 'reaction', 'pollVote', 'clipNotes', 'Favorites'],
		},
		limitCount: {
			type: 'integer',
			nullable: true,
		},
		intervalMinutes: {
			type: 'integer',
			nullable: true,
		},
		discardProgress: {
			type: 'boolean',
			nullable: true,
		},
	},
	required: ['index'],
} as const;

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		private advancedSearchService: AdvancedSearchService,
	) {
		super(meta, paramDef, async (ps, me) => {
			switch (ps.index) {
				case 'notes':
					this.advancedSearchService.fullIndexNoteQueue(ps.limitCount ?? undefined, ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
				case 'reaction':
					this.advancedSearchService.fullIndexReactionQueue(ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
				case 'pollVote':
					this.advancedSearchService.fullIndexPollVoteQueue(ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
				case 'clipNotes':
					this.advancedSearchService.fullIndexClipNotesQueue(ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
				case 'Favorites':
					this.advancedSearchService.fullIndexFavoritesQueue(ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
			}
		});
	}
}
