/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ImportBlockingProcessorService } from '@/queue/processors/ImportBlockingProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ImportBlockingProcessorService', () => {
	let service: ImportBlockingProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ImportBlockingProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ImportBlockingProcessorService>(ImportBlockingProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
