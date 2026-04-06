/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportNotesProcessorService } from '@/queue/processors/ExportNotesProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportNotesProcessorService', () => {
	let service: ExportNotesProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportNotesProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportNotesProcessorService>(ExportNotesProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
