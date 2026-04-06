/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { AutoDeleteNotesProcessorService } from '@/queue/processors/AutoDeleteNotesProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('AutoDeleteNotesProcessorService', () => {
	let service: AutoDeleteNotesProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [AutoDeleteNotesProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<AutoDeleteNotesProcessorService>(AutoDeleteNotesProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
