/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ResyncChartsProcessorService } from '@/queue/processors/ResyncChartsProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ResyncChartsProcessorService', () => {
	let service: ResyncChartsProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ResyncChartsProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ResyncChartsProcessorService>(ResyncChartsProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
