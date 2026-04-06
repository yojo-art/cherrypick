/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportAntennasProcessorService } from '@/queue/processors/ExportAntennasProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportAntennasProcessorService', () => {
	let service: ExportAntennasProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportAntennasProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportAntennasProcessorService>(ExportAntennasProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
