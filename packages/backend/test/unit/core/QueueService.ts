/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('QueueService', () => {
	let service: QueueService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<QueueService>(QueueService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
