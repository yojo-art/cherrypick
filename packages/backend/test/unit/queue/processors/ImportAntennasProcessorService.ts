/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ImportAntennasProcessorService } from '@/queue/processors/ImportAntennasProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ImportAntennasProcessorService', () => {
	let service: ImportAntennasProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ImportAntennasProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ImportAntennasProcessorService>(ImportAntennasProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
