/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { RelationshipProcessorService } from '@/queue/processors/RelationshipProcessorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';

describe('RelationshipProcessorService', () => {
	let service: RelationshipProcessorService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [RelationshipProcessorService, QueueLoggerService],
		}).compile();
		service = app.get<RelationshipProcessorService>(RelationshipProcessorService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
