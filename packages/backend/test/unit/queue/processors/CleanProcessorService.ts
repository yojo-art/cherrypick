/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { CleanProcessorService } from '@/queue/processors/CleanProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('CleanProcessorService', () => {
	let service: CleanProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [CleanProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<CleanProcessorService>(CleanProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
