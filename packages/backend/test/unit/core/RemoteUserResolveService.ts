/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('RemoteUserResolveService', () => {
	let service: RemoteUserResolveService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<RemoteUserResolveService>(RemoteUserResolveService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
