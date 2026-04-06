/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('PerUserFollowingChart', () => {
	let service: PerUserFollowingChart;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<PerUserFollowingChart>(PerUserFollowingChart);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
