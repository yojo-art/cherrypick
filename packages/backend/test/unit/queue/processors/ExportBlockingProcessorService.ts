/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportBlockingProcessorService } from '@/queue/processors/ExportBlockingProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportBlockingProcessorService', () => {
	let service: ExportBlockingProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportBlockingProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportBlockingProcessorService>(ExportBlockingProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
