/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import * as Redis from 'ioredis';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'read:admin:reindex',
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
} as const;

type FullIndexProgress = {
	status: string;
	current: number;
	total: number;
	latestid: string;
	startedAt: number;
	completedAt?: number;
};

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,
	) {
		super(meta, paramDef, async (_ps, _me) => {
			const raw = await this.redisClient.get('fullIndexNote:progress');
			if (!raw) {
				return {
					status: null,
					current: null,
					total: null,
					progressPercent: null,
					latestid: null,
					startedAt: null,
					completedAt: null,
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
					progressPercent: null,
					latestid: null,
					startedAt: null,
					completedAt: null,
				};
			}

			const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
			const isString = (v: unknown): v is string => typeof v === 'string';

			const status = isString(parsed.status) && ['running', 'paused', 'completed'].includes(parsed.status)
				? parsed.status
				: null;
			const current = isNumber(parsed.current) ? parsed.current : null;
			const total = isNumber(parsed.total) ? parsed.total : null;
			const latestid = isString(parsed.latestid) ? parsed.latestid : null;
			const startedAt = isNumber(parsed.startedAt) ? parsed.startedAt : null;
			const completedAt = isNumber(parsed.completedAt) ? parsed.completedAt : null;

			return {
				status,
				current,
				total,
				latestid,
				progressPercent: (current != null && total != null && total > 0)
					? Math.floor((current / total) * 100)
					: null,
				startedAt,
				completedAt,
			};
		});
	}
}
