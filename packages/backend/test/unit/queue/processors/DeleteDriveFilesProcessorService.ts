/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { DeleteDriveFilesProcessorService } from '@/queue/processors/DeleteDriveFilesProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('DeleteDriveFilesProcessorService', () => {
	let service: DeleteDriveFilesProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [DeleteDriveFilesProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<DeleteDriveFilesProcessorService>(DeleteDriveFilesProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
