/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import DriveChart from '@/core/chart/charts/drive.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('DriveChart', () => {
	let service: DriveChart;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<DriveChart>(DriveChart);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
