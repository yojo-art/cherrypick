/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { DeliverProcessorService } from '@/queue/processors/DeliverProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('DeliverProcessorService', () => {
	let service: DeliverProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [DeliverProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<DeliverProcessorService>(DeliverProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
