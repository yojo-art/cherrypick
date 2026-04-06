/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ScheduledNoteDeleteProcessorService } from '@/queue/processors/ScheduledNoteDeleteProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ScheduledNoteDeleteProcessorService', () => {
	let service: ScheduledNoteDeleteProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ScheduledNoteDeleteProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ScheduledNoteDeleteProcessorService>(ScheduledNoteDeleteProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
