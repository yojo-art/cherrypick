/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import * as Redis from 'ioredis';
import { FullIndexStatus } from '@/core/AdvancedSearchService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'read:admin:reindex',

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			status: {
				type: 'string',
				optional: false, nullable: true,
				enum: ['running', 'paused', 'queued', 'completed', 'aborted'],
			},
			current: {
				type: 'number',
				optional: false, nullable: true,
			},
			total: {
				type: 'number',
				optional: false, nullable: true,
			},
			latestid: {
				type: 'string',
				optional: false, nullable: true,
				format: 'misskey:id',
			},
			startedAt: {
				type: 'number',
				optional: false, nullable: true,
			},
			completedAt: {
				type: 'number',
				optional: false, nullable: true,
			},
			nextRunAt: {
				type: 'number',
				optional: false, nullable: true,
			},
			limitCount: {
				type: 'number',
				optional: false, nullable: true,
			},
			intervalMinutes: {
				type: 'number',
				optional: false, nullable: true,
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
			default: 'notes',
		},
	},
} as const;

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,
	) {
		super(meta, paramDef, async (ps, _me) => {
			const prefixMap: Record<string, string> = {
				notes: 'fullIndexNote:',
				reaction: 'fullIndexReaction:',
				pollVote: 'fullIndexPollVote:',
				clipNotes: 'fullIndexClipNotes:',
				Favorites: 'fullIndexFavorites:',
			};
			const prefix = prefixMap[ps.index ?? 'notes'];
			const raw = await this.redisClient.get(`${prefix}progress`);
			if (!raw) {
				return {
					status: null,
					current: null,
					total: null,
					latestid: null,
					startedAt: null,
					completedAt: null,
					nextRunAt: null,
					limitCount: null,
					intervalMinutes: null,
				};
			}

			let parsed: Record<string, unknown>;
			try {
				parsed = JSON.parse(raw) as Record<string, unknown>;
			} catch (_err) {
				return {
					status: null,
					current: null,
					total: null,
					latestid: null,
					startedAt: null,
					completedAt: null,
					nextRunAt: null,
					limitCount: null,
					intervalMinutes: null,
				};
			}

			const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
			const isString = (v: unknown): v is string => typeof v === 'string';

			let status: FullIndexStatus | null = isString(parsed.status) && ['running', 'paused', 'queued', 'completed', 'aborted'].includes(parsed.status)
				? (parsed.status as FullIndexStatus)
				: null;

			if (status === 'paused' && ps.index === 'notes') {
				const nextDelayRaw = await this.redisClient.get('fullIndexNote:nextDelay');
				const nextRunAt = nextDelayRaw ? Number(nextDelayRaw) : null;
				if (nextRunAt && Date.now() < nextRunAt) {
					status = 'queued';
				}
			}

			const current = isNumber(parsed.current) ? parsed.current : null;
			const total = isNumber(parsed.total) ? parsed.total : null;
			const latestid = isString(parsed.latestid) ? parsed.latestid : null;
			const startedAt = isNumber(parsed.startedAt) ? parsed.startedAt : null;
			const completedAt = isNumber(parsed.completedAt) ? parsed.completedAt : null;
			const limitCount = isNumber(parsed.limitCount) ? parsed.limitCount : null;
			const intervalMinutes = isNumber(parsed.intervalMinutes) ? parsed.intervalMinutes : null;

			return {
				status,
				current,
				total,
				latestid,
				startedAt,
				completedAt,
				nextRunAt: status === 'queued' && ps.index === 'notes'
					? Number(await this.redisClient.get('fullIndexNote:nextDelay'))
					: null,
				limitCount,
				intervalMinutes,
			};
		});
	}
}
