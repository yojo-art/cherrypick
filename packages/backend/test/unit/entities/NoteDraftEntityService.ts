/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { NoteDraftEntityService } from '@/core/entities/NoteDraftEntityService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('NoteDraftEntityService', () => {
	let service: NoteDraftEntityService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<NoteDraftEntityService>(NoteDraftEntityService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
