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

/**
 * notes 以外（reaction / pollVote / clipNotes / Favorites）の一括再インデックスジョブは、
 * 「対象を再インデックスして、一時停止したら5分後に再実行を予約する」という処理が全て共通のため、
 * 種別ごとにファイルを分けず、このサービス1つで処理する。
 */
export type SimpleFullIndexJobName = 'fullIndexReaction' | 'fullIndexPollVote' | 'fullIndexClipNotes' | 'fullIndexFavorites';

@Injectable()
export class FullIndexGenericProcessorService {
	private readonly runners: Record<SimpleFullIndexJobName, (maxDurationMin: number) => Promise<void>>;
	private readonly redisPrefixes: Record<SimpleFullIndexJobName, string>;

	constructor(
		private advancedSearchService: AdvancedSearchService,
		@Inject(DI.redis) private redisClient: Redis.Redis,
		private queueService: QueueService,
	) {
		this.runners = {
			fullIndexReaction: (m) => this.advancedSearchService.fullIndexReaction(m),
			fullIndexPollVote: (m) => this.advancedSearchService.fullIndexPollVote(m),
			fullIndexClipNotes: (m) => this.advancedSearchService.fullIndexClipNotes(m),
			fullIndexFavorites: (m) => this.advancedSearchService.fullIndexFavorites(m),
		};
		this.redisPrefixes = {
			fullIndexReaction: 'fullIndexReaction:',
			fullIndexPollVote: 'fullIndexPollVote:',
			fullIndexClipNotes: 'fullIndexClipNotes:',
			fullIndexFavorites: 'fullIndexFavorites:',
		};
	}

	@bindThis
	public async process(jobName: SimpleFullIndexJobName, _job: Bull.Job<Record<string, unknown>>): Promise<void> {
		await this.runners[jobName](FULL_INDEX_MAX_DURATION_MIN);

		const prefix = this.redisPrefixes[jobName];
		const raw = await this.redisClient.get(`${prefix}progress`);
		if (!raw) return;

		const parsed = JSON.parse(raw) as FullIndexProgress;

		if (parsed.status === 'paused') {
			const delayMs = 5 * 60 * 1000;
			const nextRunAt = Date.now() + delayMs;
			await this.queueService.systemQueue.add(jobName, {}, {
				delay: delayMs,
				jobId: `${jobName}-${Date.now()}`,
			});
			await this.redisClient.set(`${prefix}nextDelay`, String(nextRunAt), 'EX', 600);
		}
	}
}
