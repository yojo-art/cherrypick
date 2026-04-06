/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { AggregateRetentionProcessorService } from '@/queue/processors/AggregateRetentionProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('AggregateRetentionProcessorService', () => {
	let service: AggregateRetentionProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [AggregateRetentionProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<AggregateRetentionProcessorService>(AggregateRetentionProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
