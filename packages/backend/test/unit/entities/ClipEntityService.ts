/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ClipEntityService', () => {
	let service: ClipEntityService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ClipEntityService>(ClipEntityService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
