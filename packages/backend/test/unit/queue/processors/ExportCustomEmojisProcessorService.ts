/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportCustomEmojisProcessorService } from '@/queue/processors/ExportCustomEmojisProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportCustomEmojisProcessorService', () => {
	let service: ExportCustomEmojisProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportCustomEmojisProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportCustomEmojisProcessorService>(ExportCustomEmojisProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
