/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { FeaturedService } from '@/core/FeaturedService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('FeaturedService', () => {
	let featuredService: FeaturedService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		featuredService = app.get<FeaturedService>(FeaturedService);
	});

	describe('updateGlobalNotesRanking', () => {
		test('does not throw', async () => {
			await expect(featuredService.updateGlobalNotesRanking('test-note-id')).resolves.not.toThrow();
		});

		test('with custom score', async () => {
			await expect(featuredService.updateGlobalNotesRanking('test-note-id', 5)).resolves.not.toThrow();
		});
	});

	describe('getGlobalNotesRanking', () => {
		test('returns array', async () => {
			const result = await featuredService.getGlobalNotesRanking(10);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('updateHashtagsRanking', () => {
		test('does not throw', async () => {
			await expect(featuredService.updateHashtagsRanking('test-hashtag')).resolves.not.toThrow();
		});
	});

	describe('getHashtagsRanking', () => {
		test('returns array', async () => {
			const result = await featuredService.getHashtagsRanking(10);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('removeHashtagsFromRanking', () => {
		test('does not throw', async () => {
			await expect(featuredService.removeHashtagsFromRanking('test-hashtag')).resolves.not.toThrow();
		});
	});

	describe('updatePerUserNotesRanking', () => {
		test('does not throw', async () => {
			await expect(featuredService.updatePerUserNotesRanking('user-id', 'note-id')).resolves.not.toThrow();
		});
	});

	describe('getPerUserNotesRanking', () => {
		test('returns array', async () => {
			const result = await featuredService.getPerUserNotesRanking('user-id', 10);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('updateGalleryPostsRanking', () => {
		test('does not throw', async () => {
			await expect(featuredService.updateGalleryPostsRanking('gallery-post-id')).resolves.not.toThrow();
		});
	});

	describe('getGalleryPostsRanking', () => {
		test('returns array', async () => {
			const result = await featuredService.getGalleryPostsRanking(10);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('updateInChannelNotesRanking', () => {
		test('does not throw', async () => {
			await expect(featuredService.updateInChannelNotesRanking('channel-id', 'note-id')).resolves.not.toThrow();
		});
	});

	describe('getInChannelNotesRanking', () => {
		test('returns array', async () => {
			const result = await featuredService.getInChannelNotesRanking('channel-id', 10);
			expect(Array.isArray(result)).toBe(true);
		});
	});
});
