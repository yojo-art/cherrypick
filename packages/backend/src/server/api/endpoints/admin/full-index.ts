/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, TeamNijimiss(@nafu-at), yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { OpenSearchService } from '@/core/OpenSearchService.js';

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
	},
	required: ['index'],
} as const;

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		private openSearchService: OpenSearchService,
	) {
		super(meta, paramDef, async (ps, me) => {
			switch (ps.index) {
				case 'notes':
					this.openSearchService.fullIndexNote();
					break;
				case 'reaction':
					this.openSearchService.fullIndexReaction();
					break;
				case 'pollVote':
					this.openSearchService.fullIndexPollVote();
					break;
				case 'clipNotes':
					this.openSearchService.fullIndexClipNotes();
					break;
				case 'Favorites':
					this.openSearchService.fullIndexFavorites();
					break;
			}
		},
		);
	}
}
