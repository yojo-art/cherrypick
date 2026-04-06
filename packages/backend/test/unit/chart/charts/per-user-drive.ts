/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import PerUserDriveChart from '@/core/chart/charts/per-user-drive.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('PerUserDriveChart', () => {
	let service: PerUserDriveChart;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<PerUserDriveChart>(PerUserDriveChart);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
