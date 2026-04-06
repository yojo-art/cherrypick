/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { NoteUpdateService } from '@/core/NoteUpdateService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('NoteUpdateService', () => {
	let service: NoteUpdateService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<NoteUpdateService>(NoteUpdateService);
	});

	test('should be defined', () => {

	test('methods are accessible', () => {
		expect(typeof service).toBe('object');
	});
		expect(service).toBeDefined();
	});
});
