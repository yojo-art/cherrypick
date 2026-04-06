/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ImportCustomEmojisProcessorService } from '@/queue/processors/ImportCustomEmojisProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ImportCustomEmojisProcessorService', () => {
	let service: ImportCustomEmojisProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ImportCustomEmojisProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ImportCustomEmojisProcessorService>(ImportCustomEmojisProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
