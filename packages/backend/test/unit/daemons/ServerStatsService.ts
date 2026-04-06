/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ServerStatsService } from '@/daemons/ServerStatsService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ServerStatsService', () => {
	let service: ServerStatsService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [ServerStatsService],
		}).compile();
		service = app.get<ServerStatsService>(ServerStatsService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});

	test('start does not throw when stats disabled', async () => {
		// enableServerMachineStatsがfalseなら早期return
		await expect(service.start()).resolves.not.toThrow();
	});
});
