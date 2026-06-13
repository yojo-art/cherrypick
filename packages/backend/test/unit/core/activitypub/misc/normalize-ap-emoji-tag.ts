/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { normalizeApEmojiTag } from '@/core/activitypub/misc/normalize-ap-emoji-tag.js';
import type { IApEmoji } from '@/core/activitypub/type.js';

function createApEmojiTag(overrides: Partial<IApEmoji> = {}): IApEmoji {
	return {
		type: 'Emoji',
		name: ':test:',
		updated: new Date().toISOString(),
		icon: {
			type: 'Image',
			url: 'https://example.com/emoji.png',
		},
		...overrides,
	};
}

describe(normalizeApEmojiTag, () => {
	it('必須フィールドのみのとき拡張プロパティをデフォルト値で埋める', () => {
		expect(normalizeApEmojiTag(createApEmojiTag())).toEqual({
			license: null,
			isSensitive: false,
			copyPermission: null,
			category: null,
			aliases: [],
			usageInfo: null,
			author: null,
			description: null,
			isBasedOn: null,
		});
	});

	it('keywords が欠落しているとき aliases は空配列になる', () => {
		expect(normalizeApEmojiTag(createApEmojiTag()).aliases).toEqual([]);
	});

	it('keywords が null のとき aliases は空配列になる', () => {
		expect(normalizeApEmojiTag(createApEmojiTag({ keywords: null as unknown as string[] })).aliases).toEqual([]);
	});

	it('keywords が配列でないとき aliases は空配列になる', () => {
		expect(normalizeApEmojiTag(createApEmojiTag({ keywords: 'alias' as unknown as string[] })).aliases).toEqual([]);
	});

	it('keywords が配列のときそのまま aliases になる', () => {
		expect(normalizeApEmojiTag(createApEmojiTag({ keywords: ['a', 'b'] })).aliases).toEqual(['a', 'b']);
	});

	it('不正な copyPermission は null になる', () => {
		expect(normalizeApEmojiTag(createApEmojiTag({ copyPermission: 'unknown' as 'allow' })).copyPermission).toBeNull();
		expect(normalizeApEmojiTag(createApEmojiTag({ copyPermission: '' as 'allow' })).copyPermission).toBeNull();
	});

	it('有効な copyPermission はそのまま保持される', () => {
		for (const copyPermission of ['allow', 'deny', 'conditional'] as const) {
			expect(normalizeApEmojiTag(createApEmojiTag({ copyPermission })).copyPermission).toBe(copyPermission);
		}
	});

	it('_misskey_license.freeText から license を解決する', () => {
		expect(normalizeApEmojiTag(createApEmojiTag({
			_misskey_license: { freeText: 'CC BY 4.0' },
		})).license).toBe('CC BY 4.0');
	});

	it('license が _misskey_license.freeText より優先される', () => {
		expect(normalizeApEmojiTag(createApEmojiTag({
			license: 'MIT',
			_misskey_license: { freeText: 'CC BY 4.0' },
		})).license).toBe('MIT');
	});

	it('文字列以外の optional 文字列フィールドは null になる', () => {
		expect(normalizeApEmojiTag(createApEmojiTag({
			category: 123 as unknown as string,
			usageInfo: {} as unknown as string,
			description: [] as unknown as string,
			isBasedOn: false as unknown as string,
		}))).toMatchObject({
			category: null,
			usageInfo: null,
			description: null,
			isBasedOn: null,
		});
	});

	it('拡張プロパティがすべて指定されているときそのまま保持される', () => {
		expect(normalizeApEmojiTag(createApEmojiTag({
			license: 'license',
			isSensitive: true,
			copyPermission: 'conditional',
			category: 'category',
			keywords: ['a', 'b'],
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'https://example.com/original',
		}))).toEqual({
			license: 'license',
			isSensitive: true,
			copyPermission: 'conditional',
			category: 'category',
			aliases: ['a', 'b'],
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'https://example.com/original',
		});
	});
});
