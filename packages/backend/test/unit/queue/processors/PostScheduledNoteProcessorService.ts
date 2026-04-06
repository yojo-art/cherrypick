/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { PostScheduledNoteProcessorService } from '@/queue/processors/PostScheduledNoteProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('PostScheduledNoteProcessorService', () => {
	let service: PostScheduledNoteProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [PostScheduledNoteProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<PostScheduledNoteProcessorService>(PostScheduledNoteProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
