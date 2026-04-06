/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { isUserRelated } from '@/misc/is-user-related.js';

describe('misc:is-user-related', () => {
	const userIds = new Set(['user1', 'user2']);

	test('null note returns false', () => {
		expect(isUserRelated(null, userIds)).toBe(false);
	});

	test('undefined note returns false', () => {
		expect(isUserRelated(undefined, userIds)).toBe(false);
	});

	test('note author matches', () => {
		expect(isUserRelated({ userId: 'user1' }, userIds)).toBe(true);
	});

	test('note author matches but ignoreAuthor is true', () => {
		expect(isUserRelated({ userId: 'user1' }, userIds, true)).toBe(false);
	});

	test('reply user matches via replyUserId', () => {
		expect(isUserRelated({ userId: 'other', replyUserId: 'user1' }, userIds)).toBe(true);
	});

	test('reply user matches via reply.userId', () => {
		expect(isUserRelated({ userId: 'other', reply: { userId: 'user2' } }, userIds)).toBe(true);
	});

	test('renote user matches via renoteUserId', () => {
		expect(isUserRelated({ userId: 'other', renoteUserId: 'user1' }, userIds)).toBe(true);
	});

	test('renote user matches via renote.userId', () => {
		expect(isUserRelated({ userId: 'other', renote: { userId: 'user2' } }, userIds)).toBe(true);
	});

	test('no match returns false', () => {
		expect(isUserRelated({ userId: 'other', replyUserId: 'another', renoteUserId: 'someone' }, userIds)).toBe(false);
	});

	test('replyUserId same as note author is not matched', () => {
		// replyUserId === note.userId, so it's skipped
		expect(isUserRelated({ userId: 'user1', replyUserId: 'user1' }, userIds, true)).toBe(false);
	});

	test('renoteUserId same as note author is not matched', () => {
		expect(isUserRelated({ userId: 'user1', renoteUserId: 'user1' }, userIds, true)).toBe(false);
	});
});
