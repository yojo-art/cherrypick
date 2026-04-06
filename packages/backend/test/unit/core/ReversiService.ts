/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ReversiService } from '@/core/ReversiService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ReversiService', () => {
	let service: ReversiService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ReversiService>(ReversiService);
	});

	test('should be defined', () => {

	test('methods are accessible', () => {
		expect(typeof service).toBe('object');
	});
		expect(service).toBeDefined();
	});
});
