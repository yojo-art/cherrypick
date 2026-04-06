/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ApQuestionService } from '@/core/activitypub/models/ApQuestionService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ApQuestionService', () => {
	let service: ApQuestionService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ApQuestionService>(ApQuestionService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
