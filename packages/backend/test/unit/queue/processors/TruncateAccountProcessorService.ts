/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { TruncateAccountProcessorService } from '@/queue/processors/TruncateAccountProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('TruncateAccountProcessorService', () => {
	let service: TruncateAccountProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [TruncateAccountProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<TruncateAccountProcessorService>(TruncateAccountProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
