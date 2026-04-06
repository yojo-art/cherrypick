/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import PerUserPvChart from '@/core/chart/charts/per-user-pv.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('PerUserPvChart', () => {
	let service: PerUserPvChart;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<PerUserPvChart>(PerUserPvChart);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
