/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('EmojiEntityService', () => {
	let service: EmojiEntityService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<EmojiEntityService>(EmojiEntityService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('packSimple', () => {
		test('packs emoji object', async () => {
			const emoji = {
				id: 'test-id',
				name: 'test_emoji',
				aliases: ['alias1'],
				category: 'test',
				publicUrl: 'https://example.com/emoji.png',
				originalUrl: 'https://example.com/emoji-orig.png',
				localOnly: false,
				isSensitive: false,
				roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			} as any;

			const packed = await service.packSimple(emoji);
			expect(packed.name).toBe('test_emoji');
			expect(packed.url).toBe('https://example.com/emoji.png');
			expect(packed.aliases).toEqual(['alias1']);
			expect(packed.category).toBe('test');
		});

		test('packs sensitive emoji', async () => {
			const emoji = {
				id: 'test-id',
				name: 'sensitive_emoji',
				aliases: [],
				category: null,
				publicUrl: 'https://example.com/emoji.png',
				originalUrl: 'https://example.com/emoji-orig.png',
				localOnly: true,
				isSensitive: true,
				roleIdsThatCanBeUsedThisEmojiAsReaction: ['role1'],
			} as any;

			const packed = await service.packSimple(emoji);
			expect(packed.isSensitive).toBe(true);
			expect(packed.localOnly).toBe(true);
			expect(packed.roleIdsThatCanBeUsedThisEmojiAsReaction).toEqual(['role1']);
		});

		test('uses originalUrl when publicUrl is empty', async () => {
			const emoji = {
				id: 'test-id',
				name: 'emoji',
				aliases: [],
				category: null,
				publicUrl: '',
				originalUrl: 'https://example.com/original.png',
				localOnly: false,
				isSensitive: false,
				roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			} as any;

			const packed = await service.packSimple(emoji);
			expect(packed.url).toBe('https://example.com/original.png');
		});
	});
});
