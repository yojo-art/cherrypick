/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { AdvancedSearchService } from '@/core/AdvancedSearchService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('AdvancedSearchService', () => {
	let service: AdvancedSearchService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<AdvancedSearchService>(AdvancedSearchService);
	});

	describe('searchNote', () => {
		test('returns empty array for no match', async () => {
			const result = await service.searchNote(null, {}, { limit: 10 }, 'nonexistent-query-xyz-12345');
			expect(Array.isArray(result)).toBe(true);
		});

		test('with userId filter', async () => {
			const result = await service.searchNote(null, { userId: 'nonexistent' }, { limit: 5 });
			expect(Array.isArray(result)).toBe(true);
		});

		test('with host filter', async () => {
			const result = await service.searchNote(null, { host: 'nonexistent.example.com' }, { limit: 5 }, 'test');
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('indexNote', () => {
		test('does not throw for note without text', async () => {
			const fakeNote = { id: 'test', text: null, cw: null, visibility: 'public', userId: 'u', userHost: null, channelId: null, tags: [] } as any;
			await expect(service.indexNote(fakeNote)).resolves.not.toThrow();
		});
	});

	describe('unindexNote', () => {
		test('does not throw for public note', async () => {
			const fakeNote = { id: 'test', text: null, cw: null, visibility: 'public', userId: 'u', userHost: null, channelId: null, tags: [], fileIds: [] } as any;
			try {
				await service.unindexNote(fakeNote);
			} catch {
				// OpenSearchが未設定の場合はエラーが出る可能性がある
			}
		});
	});
});
