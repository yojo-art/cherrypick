/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert } from 'vitest';
import * as Misskey from 'misskey-js';
import { checkReactionPermissions } from '@/utility/check-reaction-permissions.js';

const me = {
	host: null,
	roles: [],
} as unknown as Misskey.entities.MeDetailed;

function customEmoji(partial: Partial<Misskey.entities.EmojiSimple>): Misskey.entities.EmojiSimple {
	return {
		id: 'emoji-id',
		name: 'sensitive_emoji',
		host: null,
		category: null,
		aliases: [],
		url: 'https://example.com/emoji.png',
		width: 128,
		height: 128,
		isSensitive: false,
		localOnly: false,
		roleIdsThatCanBeUsedThisEmojiAsReaction: [],
		...partial,
	} as Misskey.entities.EmojiSimple;
}

const noteTarget = (reactionAcceptance: Misskey.entities.Note['reactionAcceptance']) => ({
	reactionAcceptance,
	user: { host: null },
} as Pick<Misskey.entities.Note, 'reactionAcceptance' | 'user'>);

describe('checkReactionPermissions', () => {
	test('ノートがnonSensitiveOnlyの場合、センシティブ絵文字は選択不可', () => {
		assert.strictEqual(checkReactionPermissions(me, noteTarget('nonSensitiveOnly'), customEmoji({ isSensitive: true })), false);
	});

	test('ノートの受け入れ設定がnullの場合、センシティブ絵文字は選択可能', () => {
		assert.strictEqual(checkReactionPermissions(me, noteTarget(null), customEmoji({ isSensitive: true })), true);
	});

	test('お知らせ(nonSensitiveOnly)の場合、センシティブ絵文字は選択不可', () => {
		assert.strictEqual(checkReactionPermissions(me, { reactionAcceptance: 'nonSensitiveOnly' }, customEmoji({ isSensitive: true })), false);
	});

	test('お知らせ(nonSensitiveOnly)の場合、非センシティブ絵文字は選択可能', () => {
		assert.strictEqual(checkReactionPermissions(me, { reactionAcceptance: 'nonSensitiveOnly' }, customEmoji({ isSensitive: false })), true);
	});

	test('お知らせの受け入れ設定がnullの場合、センシティブ絵文字は選択可能', () => {
		assert.strictEqual(checkReactionPermissions(me, { reactionAcceptance: null }, customEmoji({ isSensitive: true })), true);
	});

	test('お知らせの場合もロール制限絵文字は選択不可', () => {
		assert.strictEqual(
			checkReactionPermissions(me, { reactionAcceptance: null }, customEmoji({ roleIdsThatCanBeUsedThisEmojiAsReaction: ['role-id'] })),
			false,
		);
	});

	test('Unicode絵文字は受け入れ設定に関わらず選択可能', () => {
		assert.strictEqual(checkReactionPermissions(me, { reactionAcceptance: 'nonSensitiveOnly' }, '❤'), true);
		assert.strictEqual(checkReactionPermissions(me, { reactionAcceptance: 'nonSensitiveOnly' }, { char: '❤', name: 'heart' }), true);
	});
});
