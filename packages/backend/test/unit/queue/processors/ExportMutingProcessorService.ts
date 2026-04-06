/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportMutingProcessorService } from '@/queue/processors/ExportMutingProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportMutingProcessorService', () => {
	let service: ExportMutingProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportMutingProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportMutingProcessorService>(ExportMutingProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
