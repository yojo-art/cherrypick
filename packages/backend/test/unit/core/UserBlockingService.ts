/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('UserBlockingService', () => {
	let service: UserBlockingService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<UserBlockingService>(UserBlockingService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
