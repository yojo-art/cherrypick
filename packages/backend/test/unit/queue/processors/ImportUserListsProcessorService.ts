/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ImportUserListsProcessorService } from '@/queue/processors/ImportUserListsProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ImportUserListsProcessorService', () => {
	let service: ImportUserListsProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ImportUserListsProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ImportUserListsProcessorService>(ImportUserListsProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
