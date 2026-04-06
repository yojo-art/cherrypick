/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { NoteHistorySerivce } from '@/core/NoteHistoryService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('NoteHistorySerivce', () => {
	let service: NoteHistorySerivce;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<NoteHistorySerivce>(NoteHistorySerivce);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
