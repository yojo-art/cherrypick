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
export class FullIndexPollVoteProcessorService {
	constructor(
		private advancedSearchService: AdvancedSearchService,
		@Inject(DI.redis) private redisClient: Redis.Redis,
		private queueService: QueueService,
	) {}

	@bindThis
	public async process(_job: Bull.Job<Record<string, unknown>>): Promise<void> {
		await this.advancedSearchService.fullIndexPollVote(FULL_INDEX_MAX_DURATION_MIN);

		const raw = await this.redisClient.get('fullIndexPollVote:progress');
		if (!raw) return;

		const parsed = JSON.parse(raw) as FullIndexProgress;

		if (parsed.status === 'paused') {
			const delayMs = 5 * 60 * 1000;
			const nextRunAt = Date.now() + delayMs;
			await this.queueService.systemQueue.add('fullIndexPollVote', {}, {
				delay: delayMs,
				jobId: `fullIndexPollVote-${Date.now()}`,
			});
			await this.redisClient.set('fullIndexPollVote:nextDelay', String(nextRunAt), 'EX', 600);
		}
	}
}
