/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { QueueStatsService } from '@/daemons/QueueStatsService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('QueueStatsService', () => {
	let service: QueueStatsService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [QueueStatsService],
		}).compile();
		service = app.get<QueueStatsService>(QueueStatsService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
