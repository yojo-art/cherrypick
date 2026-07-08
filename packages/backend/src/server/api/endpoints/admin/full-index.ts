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

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false, nullable: false,
			},
		},
	},
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
			minimum: 1,
			maximum: 100000000,
		},
		intervalMinutes: {
			// 再開遅延（分）。progress キーの生存時間を超える値を許すと待機中にキーが失効し、
			// latestid='' から再スタート＝先頭チャンクの無限再インデックスになるため上限を設ける。
			// 0以下は遅延0での即時再enqueueループになるため下限も設ける。
			type: 'integer',
			nullable: true,
			minimum: 1,
			maximum: 60,
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
					this.advancedSearchService.fullIndexReactionQueue(ps.limitCount ?? undefined, ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
				case 'pollVote':
					this.advancedSearchService.fullIndexPollVoteQueue(ps.limitCount ?? undefined, ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
				case 'clipNotes':
					this.advancedSearchService.fullIndexClipNotesQueue(ps.limitCount ?? undefined, ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
				case 'Favorites':
					this.advancedSearchService.fullIndexFavoritesQueue(ps.limitCount ?? undefined, ps.intervalMinutes ?? undefined, ps.discardProgress ?? false);
					break;
			}

			return { success: true };
		});
	}
}
