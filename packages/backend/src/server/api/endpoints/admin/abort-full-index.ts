/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { QueueService } from '@/core/QueueService.js';
import { FullIndexProgress } from '@/core/AdvancedSearchService.js';

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
	properties: {},
} as const;

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,
		private queueService: QueueService,
	) {
		super(meta, paramDef, async (_ps, _me) => {
			await this.redisClient.set('fullIndexNote:abort', '1', 'EX', 300);
			await this.queueService.removeDelayedFullIndexJobs();
			await this.redisClient.del('fullIndexNote:nextDelay');

			const raw = await this.redisClient.get('fullIndexNote:progress');
			if (raw) {
				try {
					const parsed = JSON.parse(raw) as Partial<FullIndexProgress>;
					parsed.status = 'aborted';
					await this.redisClient.set('fullIndexNote:progress', JSON.stringify(parsed), 'EX', 3600);
				} catch {}
			}

			return { success: true };
		});
	}
}
