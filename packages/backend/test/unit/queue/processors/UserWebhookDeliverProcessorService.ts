/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { UserWebhookDeliverProcessorService } from '@/queue/processors/UserWebhookDeliverProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('UserWebhookDeliverProcessorService', () => {
	let service: UserWebhookDeliverProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [UserWebhookDeliverProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<UserWebhookDeliverProcessorService>(UserWebhookDeliverProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
