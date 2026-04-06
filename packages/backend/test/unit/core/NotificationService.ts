/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { NotificationService } from '@/core/NotificationService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('NotificationService', () => {
	let service: NotificationService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<NotificationService>(NotificationService);
	});

	test('should be defined', () => {

	test('methods are accessible', () => {
		expect(typeof service).toBe('object');
	});
		expect(service).toBeDefined();
	});
});
