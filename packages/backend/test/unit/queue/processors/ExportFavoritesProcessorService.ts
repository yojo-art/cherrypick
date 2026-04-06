/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ExportFavoritesProcessorService } from '@/queue/processors/ExportFavoritesProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ExportFavoritesProcessorService', () => {
	let service: ExportFavoritesProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ExportFavoritesProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ExportFavoritesProcessorService>(ExportFavoritesProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
