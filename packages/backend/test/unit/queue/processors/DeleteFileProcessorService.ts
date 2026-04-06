/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { DeleteFileProcessorService } from '@/queue/processors/DeleteFileProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('DeleteFileProcessorService', () => {
	let service: DeleteFileProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [DeleteFileProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<DeleteFileProcessorService>(DeleteFileProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
