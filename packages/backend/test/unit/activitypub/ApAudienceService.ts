/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ApAudienceService } from '@/core/activitypub/ApAudienceService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ApAudienceService', () => {
	let service: ApAudienceService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ApAudienceService>(ApAudienceService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
