/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, TeamNijimiss(@nafu-at), yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { AdvancedSearchService } from '@/core/AdvancedSearchService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:reindex',

	errors: {
		alreadyRunning: {
			message: 'Full index is already running or in progress.',
			code: 'FULL_INDEX_ALREADY_RUNNING',
			id: 'f4a8b1c2-3d5e-4f6a-9b0c-1d2e3f4a5b6c',
			kind: 'client',
			httpStatusCode: 409,
		},
	},

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
			const limitCount = ps.limitCount ?? undefined;
			const intervalMinutes = ps.intervalMinutes ?? undefined;
			const discardProgress = ps.discardProgress ?? false;

			try {
				await this.advancedSearchService.assertCanEnqueueFullIndex(ps.index, discardProgress);
			} catch (err) {
				if (err instanceof IdentifiableError && err.id === meta.errors.alreadyRunning.id) {
					throw new ApiError(meta.errors.alreadyRunning);
				}
				throw err;
			}

			switch (ps.index) {
				case 'notes':
					await this.advancedSearchService.fullIndexNoteQueue(limitCount, intervalMinutes, discardProgress);
					break;
				case 'reaction':
					await this.advancedSearchService.fullIndexReactionQueue(limitCount, intervalMinutes, discardProgress);
					break;
				case 'pollVote':
					await this.advancedSearchService.fullIndexPollVoteQueue(limitCount, intervalMinutes, discardProgress);
					break;
				case 'clipNotes':
					await this.advancedSearchService.fullIndexClipNotesQueue(limitCount, intervalMinutes, discardProgress);
					break;
				case 'Favorites':
					await this.advancedSearchService.fullIndexFavoritesQueue(limitCount, intervalMinutes, discardProgress);
					break;
			}

			return { success: true };
		});
	}
}
