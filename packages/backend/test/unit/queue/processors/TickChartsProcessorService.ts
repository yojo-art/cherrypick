/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { TickChartsProcessorService } from '@/queue/processors/TickChartsProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('TickChartsProcessorService', () => {
	let service: TickChartsProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [TickChartsProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<TickChartsProcessorService>(TickChartsProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
