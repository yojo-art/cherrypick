/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ApClipService } from '@/core/activitypub/models/ApClipService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ApClipService', () => {
	let service: ApClipService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ApClipService>(ApClipService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
