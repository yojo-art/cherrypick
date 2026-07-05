/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable, Inject } from '@nestjs/common';
import * as Redis from 'ioredis';
import { AdvancedSearchService, FullIndexProgress } from '@/core/AdvancedSearchService.js';
import { QueueService } from '@/core/QueueService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type * as Bull from 'bullmq';

const FULL_INDEX_MAX_DURATION_MIN = 120;

@Injectable()
export class FullIndexNoteProcessorService {
	constructor(
		private advancedSearchService: AdvancedSearchService,
		@Inject(DI.redis) private redisClient: Redis.Redis,
		private queueService: QueueService,
	) {}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		const limitCount = typeof job.data.limitCount === 'number'
			? job.data.limitCount
			: undefined;
		const intervalMinutes = typeof job.data.intervalMinutes === 'number'
			? job.data.intervalMinutes
			: undefined;

		if (job.data.discardProgress === true) {
			await this.redisClient.del('fullIndexNote:progress');
			await this.redisClient.del('fullIndexNote:nextDelay');
		}

		await this.advancedSearchService.fullIndexNote(FULL_INDEX_MAX_DURATION_MIN, limitCount, false, intervalMinutes);

		const raw = await this.redisClient.get('fullIndexNote:progress');
		if (!raw) return;

		const parsed = JSON.parse(raw) as FullIndexProgress;

		if (parsed.status === 'paused') {
			const delayMs = (intervalMinutes ?? 5) * 60 * 1000;
			const nextRunAt = Date.now() + delayMs;
			await this.queueService.systemQueue.add('fullIndexNote', {
				limitCount,
				intervalMinutes,
			}, {
				delay: delayMs,
				jobId: `fullIndexNote-${Date.now()}`,
			});
			await this.redisClient.set('fullIndexNote:nextDelay', String(nextRunAt), 'EX', 600);
		}
	}
}
