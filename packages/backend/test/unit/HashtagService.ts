/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { HashtagService } from '@/core/HashtagService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('HashtagService', () => {
	let service: HashtagService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<HashtagService>(HashtagService);
	});

	describe('getChart', () => {
		test('returns number array for unknown hashtag', async () => {
			const result = await service.getChart('nonexistent-hashtag-xyz', 24);
			expect(Array.isArray(result)).toBe(true);
			result.forEach(v => expect(typeof v).toBe('number'));
		});
	});

	describe('getCharts', () => {
		test('returns record of number arrays', async () => {
			const result = await service.getCharts(['tag1', 'tag2'], 24);
			expect(typeof result).toBe('object');
		});
	});

	describe('updateHashtags', () => {
		test('does not throw for empty tags', async () => {
			await expect(service.updateHashtags({ id: 'user1', host: null, isBot: false }, [])).resolves.not.toThrow();
		});
	});

	describe('updateHashtagsRanking', () => {
		test('does not throw', async () => {
			await expect(service.updateHashtagsRanking('test-hashtag', 'user-id')).resolves.not.toThrow();
		});
	});
});
