/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportUserListsProcessorService } from '@/queue/processors/ExportUserListsProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportUserListsProcessorService', () => {
	let service: ExportUserListsProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportUserListsProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportUserListsProcessorService>(ExportUserListsProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
