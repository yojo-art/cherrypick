/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportClipsProcessorService } from '@/queue/processors/ExportClipsProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportClipsProcessorService', () => {
	let service: ExportClipsProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportClipsProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportClipsProcessorService>(ExportClipsProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
