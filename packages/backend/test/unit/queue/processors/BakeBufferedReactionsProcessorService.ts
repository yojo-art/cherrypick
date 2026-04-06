/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { BakeBufferedReactionsProcessorService } from '@/queue/processors/BakeBufferedReactionsProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('BakeBufferedReactionsProcessorService', () => {
	let service: BakeBufferedReactionsProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [BakeBufferedReactionsProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<BakeBufferedReactionsProcessorService>(BakeBufferedReactionsProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
