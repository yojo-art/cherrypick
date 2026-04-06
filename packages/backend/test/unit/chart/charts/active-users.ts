/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ActiveUsersChart', () => {
	let service: ActiveUsersChart;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ActiveUsersChart>(ActiveUsersChart);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
