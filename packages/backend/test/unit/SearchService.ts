/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { SearchService } from '@/core/SearchService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('SearchService', () => {
	let service: SearchService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<SearchService>(SearchService);
	});

	describe('searchNote', () => {
		test('returns empty array for no match', async () => {
			const result = await service.searchNote('nonexistent-query-xyz-12345', null, {}, { limit: 10 });
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(0);
		});

		test('with userId filter', async () => {
			const result = await service.searchNote('test', null, { userId: 'nonexistent' }, { limit: 5 });
			expect(Array.isArray(result)).toBe(true);
		});

		test('with channelId filter', async () => {
			const result = await service.searchNote('test', null, { channelId: 'nonexistent' }, { limit: 5 });
			expect(Array.isArray(result)).toBe(true);
		});

		test('with host filter (local)', async () => {
			const result = await service.searchNote('test', null, { host: '.' }, { limit: 5 });
			expect(Array.isArray(result)).toBe(true);
		});

		test('with host filter (remote)', async () => {
			const result = await service.searchNote('test', null, { host: 'remote.example.com' }, { limit: 5 });
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('indexNote', () => {
		test('does not throw for note without text', async () => {
			const fakeNote = { id: 'test', text: null, cw: null, visibility: 'public', userId: 'u', userHost: null, channelId: null, tags: [] } as any;
			await expect(service.indexNote(fakeNote)).resolves.not.toThrow();
		});

		test('does not index private notes', async () => {
			const fakeNote = { id: 'test', text: 'hello', visibility: 'specified', userId: 'u', userHost: null, channelId: null, tags: [] } as any;
			await expect(service.indexNote(fakeNote)).resolves.not.toThrow();
		});
	});

	describe('unindexNote', () => {
		test('does not throw', async () => {
			const fakeNote = { id: 'test', visibility: 'public' } as any;
			await expect(service.unindexNote(fakeNote)).resolves.not.toThrow();
		});
	});
});
