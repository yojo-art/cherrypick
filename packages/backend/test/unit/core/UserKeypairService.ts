/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { UserKeypairService } from '@/core/UserKeypairService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('UserKeypairService', () => {
	let service: UserKeypairService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<UserKeypairService>(UserKeypairService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});

	test('dispose does not throw', () => {
		expect(() => service.dispose()).not.toThrow();
	});

	test('onApplicationShutdown does not throw', () => {
		expect(() => service.onApplicationShutdown()).not.toThrow();
	});
});
