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

			const parsed = JSON.parse(raw) as {
				current: number;
				total: number;
				running: boolean;
				startedAt: number;
				completedAt?: number;
			};

			return {
				running: parsed.running,
				current: parsed.current,
				total: parsed.total,
				progressPercent: parsed.total > 0 ? Math.floor((parsed.current / parsed.total) * 100) : null,
				startedAt: parsed.startedAt,
				completedAt: parsed.completedAt ?? null,
			};
		});
	}
}
