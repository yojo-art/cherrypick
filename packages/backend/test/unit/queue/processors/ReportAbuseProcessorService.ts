/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ReportAbuseProcessorService } from '@/queue/processors/ReportAbuseProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('ReportAbuseProcessorService', () => {
	let service: ReportAbuseProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ReportAbuseProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<ReportAbuseProcessorService>(ReportAbuseProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
