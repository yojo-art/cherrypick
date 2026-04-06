/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { CleanRemoteFilesProcessorService } from '@/queue/processors/CleanRemoteFilesProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('CleanRemoteFilesProcessorService', () => {
	let service: CleanRemoteFilesProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [CleanRemoteFilesProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<CleanRemoteFilesProcessorService>(CleanRemoteFilesProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
