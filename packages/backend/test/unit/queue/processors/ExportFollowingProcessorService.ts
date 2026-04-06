/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportFollowingProcessorService } from '@/queue/processors/ExportFollowingProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportFollowingProcessorService', () => {
	let service: ExportFollowingProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportFollowingProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportFollowingProcessorService>(ExportFollowingProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
