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
const DEFAULT_RESUME_INTERVAL_MINUTES = 5;

export type FullIndexJobName = 'fullIndexNote' | 'fullIndexReaction' | 'fullIndexPollVote' | 'fullIndexClipNotes' | 'fullIndexFavorites';

/**
 * notes / reaction / pollVote / clipNotes / Favorites の一括再インデックスジョブは、
 * 「対象を再インデックスして、一時停止したら（指定分後 or デフォルト5分後）に再実行を予約する」
 * という処理が全て共通のため、種別ごとにファイルを分けずこのサービス1つで処理する。
 * limitCount / intervalMinutes / discardProgress はいずれの種別も外部（admin/full-index）から
 * 指定できるが、指定しなければ単に使われないだけなので、同じ経路で扱って問題ない。
 */
@Injectable()
export class FullIndexProcessorService {
	private readonly redisPrefixes: Record<FullIndexJobName, string> = {
		fullIndexNote: 'fullIndexNote:',
		fullIndexReaction: 'fullIndexReaction:',
		fullIndexPollVote: 'fullIndexPollVote:',
		fullIndexClipNotes: 'fullIndexClipNotes:',
		fullIndexFavorites: 'fullIndexFavorites:',
	};

	constructor(
		private advancedSearchService: AdvancedSearchService,
		@Inject(DI.redis) private redisClient: Redis.Redis,
		private queueService: QueueService,
	) {}

	@bindThis
	private async run(jobName: FullIndexJobName, maxDurationMin: number, limitCount: number | undefined, intervalMinutes: number | undefined, discardProgress: boolean): Promise<void> {
		switch (jobName) {
			case 'fullIndexNote': return this.advancedSearchService.fullIndexNote(maxDurationMin, limitCount, intervalMinutes, discardProgress);
			case 'fullIndexReaction': return this.advancedSearchService.fullIndexReaction(maxDurationMin, limitCount, intervalMinutes, discardProgress);
			case 'fullIndexPollVote': return this.advancedSearchService.fullIndexPollVote(maxDurationMin, limitCount, intervalMinutes, discardProgress);
			case 'fullIndexClipNotes': return this.advancedSearchService.fullIndexClipNotes(maxDurationMin, limitCount, intervalMinutes, discardProgress);
			case 'fullIndexFavorites': return this.advancedSearchService.fullIndexFavorites(maxDurationMin, limitCount, intervalMinutes, discardProgress);
		}
	}

	@bindThis
	public async process(jobName: FullIndexJobName, job: Bull.Job<Record<string, unknown>>): Promise<void> {
		const prefix = this.redisPrefixes[jobName];

		const limitCount = typeof job.data.limitCount === 'number'
			? job.data.limitCount
			: undefined;
		const intervalMinutes = typeof job.data.intervalMinutes === 'number'
			? job.data.intervalMinutes
			: undefined;
		const discardProgress = job.data.discardProgress === true;

		await this.run(jobName, FULL_INDEX_MAX_DURATION_MIN, limitCount, intervalMinutes, discardProgress);

		const raw = await this.redisClient.get(`${prefix}progress`);
		if (!raw) return;

		const parsed = JSON.parse(raw) as FullIndexProgress;

		if (parsed.status === 'paused') {
			const delayMs = (intervalMinutes ?? DEFAULT_RESUME_INTERVAL_MINUTES) * 60 * 1000;
			await this.queueService.dbQueue.add(jobName, {
				limitCount,
				intervalMinutes,
			}, {
				delay: delayMs,
				jobId: `${jobName}-${Date.now()}`,
			});
		}
	}
}
