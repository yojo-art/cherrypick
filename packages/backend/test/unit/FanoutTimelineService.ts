/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { FanoutTimelineService } from '@/core/FanoutTimelineService.js';
import { IdService } from '@/core/IdService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('FanoutTimelineService', () => {
	let fanoutTimelineService: FanoutTimelineService;
	let idService: IdService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		fanoutTimelineService = app.get<FanoutTimelineService>(FanoutTimelineService);
		idService = app.get<IdService>(IdService);
	});

	describe('get', () => {
		test('returns empty array for non-existent timeline', async () => {
			const result = await fanoutTimelineService.get(`homeTimeline:nonexistent-user-${Date.now()}` as any);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('getMulti', () => {
		test('returns array of arrays', async () => {
			const result = await fanoutTimelineService.getMulti([
				`homeTimeline:nonexistent1-${Date.now()}` as any,
				`homeTimeline:nonexistent2-${Date.now()}` as any,
			]);
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
		});
	});

	describe('purge', () => {
		test('does not throw for non-existent timeline', async () => {
			await expect(fanoutTimelineService.purge(`homeTimeline:nonexistent-${Date.now()}` as any)).resolves.not.toThrow();
		});
	});
});
