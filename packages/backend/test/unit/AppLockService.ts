/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { AppLockService } from '@/core/AppLockService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('AppLockService', () => {
	let service: AppLockService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<AppLockService>(AppLockService);
	});

	describe('getApLock', () => {
		test('acquires and releases lock', async () => {
			const unlock = await service.getApLock('https://example.com/test-uri');
			expect(typeof unlock).toBe('function');
			await unlock();
		});
	});

	describe('getChartInsertLock', () => {
		test('acquires and releases lock', async () => {
			const unlock = await service.getChartInsertLock('test-chart-lock');
			expect(typeof unlock).toBe('function');
			await unlock();
		});
	});
});
