/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ImportFollowingProcessorService } from '@/queue/processors/ImportFollowingProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ImportFollowingProcessorService', () => {
	let service: ImportFollowingProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ImportFollowingProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ImportFollowingProcessorService>(ImportFollowingProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
