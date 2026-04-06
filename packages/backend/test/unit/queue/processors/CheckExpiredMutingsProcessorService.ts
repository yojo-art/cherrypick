/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { CheckExpiredMutingsProcessorService } from '@/queue/processors/CheckExpiredMutingsProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('CheckExpiredMutingsProcessorService', () => {
	let service: CheckExpiredMutingsProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [CheckExpiredMutingsProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<CheckExpiredMutingsProcessorService>(CheckExpiredMutingsProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
