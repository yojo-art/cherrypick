/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { EndedPollNotificationProcessorService } from '@/queue/processors/EndedPollNotificationProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('EndedPollNotificationProcessorService', () => {
	let service: EndedPollNotificationProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [EndedPollNotificationProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<EndedPollNotificationProcessorService>(EndedPollNotificationProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
