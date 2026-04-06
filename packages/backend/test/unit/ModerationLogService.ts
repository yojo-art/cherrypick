/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ModerationLogService', () => {
	let moderationLogService: ModerationLogService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		moderationLogService = app.get<ModerationLogService>(ModerationLogService);
	});

	test('service is defined', () => {
		expect(moderationLogService).toBeDefined();
	});

	test('log method exists', () => {
		expect(typeof moderationLogService.log).toBe('function');
	});
});
