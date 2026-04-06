/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ImportMutingProcessorService } from '@/queue/processors/ImportMutingProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ImportMutingProcessorService', () => {
	let service: ImportMutingProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ImportMutingProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ImportMutingProcessorService>(ImportMutingProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
