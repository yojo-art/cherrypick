/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ReactionsBufferingService } from '@/core/ReactionsBufferingService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ReactionsBufferingService', () => {
	let service: ReactionsBufferingService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ReactionsBufferingService>(ReactionsBufferingService);
	});

	test('should be defined', () => {

	test('methods are accessible', () => {
		expect(typeof service).toBe('object');
	});
		expect(service).toBeDefined();
	});
});
