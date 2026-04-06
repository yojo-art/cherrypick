/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { InboxProcessorService } from '@/queue/processors/InboxProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('InboxProcessorService', () => {
	let service: InboxProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [InboxProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<InboxProcessorService>(InboxProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
