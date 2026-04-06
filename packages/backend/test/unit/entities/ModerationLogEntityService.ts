/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ModerationLogEntityService } from '@/core/entities/ModerationLogEntityService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ModerationLogEntityService', () => {
	let service: ModerationLogEntityService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ModerationLogEntityService>(ModerationLogEntityService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
