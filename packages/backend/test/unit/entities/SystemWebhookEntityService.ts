/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { SystemWebhookEntityService } from '@/core/entities/SystemWebhookEntityService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('SystemWebhookEntityService', () => {
	let service: SystemWebhookEntityService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<SystemWebhookEntityService>(SystemWebhookEntityService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
