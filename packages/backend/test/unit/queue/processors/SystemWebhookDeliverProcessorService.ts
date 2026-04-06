/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { SystemWebhookDeliverProcessorService } from '@/queue/processors/SystemWebhookDeliverProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('SystemWebhookDeliverProcessorService', () => {
	let service: SystemWebhookDeliverProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [SystemWebhookDeliverProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<SystemWebhookDeliverProcessorService>(SystemWebhookDeliverProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
