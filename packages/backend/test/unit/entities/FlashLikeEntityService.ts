/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { FlashLikeEntityService } from '@/core/entities/FlashLikeEntityService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('FlashLikeEntityService', () => {
	let service: FlashLikeEntityService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<FlashLikeEntityService>(FlashLikeEntityService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
