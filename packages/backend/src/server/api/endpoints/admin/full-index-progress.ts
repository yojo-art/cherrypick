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
					running: false,
					current: null,
					total: null,
					progressPercent: null,
					startedAt: null,
					completedAt: null,
				};
			}

			let parsed: Record<string, unknown>;
			try {
				parsed = JSON.parse(raw) as Record<string, unknown>;
			} catch (_err) {
				return {
					running: false,
					current: null,
					total: null,
					progressPercent: null,
					startedAt: null,
					completedAt: null,
				};
			}

			const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
			const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

			const current = isNumber(parsed.current) ? parsed.current : null;
			const total = isNumber(parsed.total) ? parsed.total : null;
			const running = isBool(parsed.running) ? parsed.running : false;
			const paused = isBool(parsed.paused) ? parsed.paused : false;
			const startedAt = isNumber(parsed.startedAt) ? parsed.startedAt : null;
			const completedAt = isNumber(parsed.completedAt) ? parsed.completedAt : null;

			return {
				running,
				current,
				total,
				paused,
				progressPercent: (current != null && total != null && total > 0)
					? Math.floor((current / total) * 100)
					: null,
				startedAt,
				completedAt,
			};
		});
	}
}
