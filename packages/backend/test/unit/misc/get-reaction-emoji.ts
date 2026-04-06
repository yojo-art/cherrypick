/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import getReactionEmoji from '@/misc/get-reaction-emoji.js';

describe('misc:get-reaction-emoji', () => {
	test('like', () => expect(getReactionEmoji('like')).toBe('\u{1F44D}'));
	test('love', () => expect(getReactionEmoji('love')).toBe('\u{2764}\u{FE0F}'));
	test('laugh', () => expect(getReactionEmoji('laugh')).toBe('\u{1F606}'));
	test('hmm', () => expect(getReactionEmoji('hmm')).toBe('\u{1F914}'));
	test('surprise', () => expect(getReactionEmoji('surprise')).toBe('\u{1F62E}'));
	test('congrats', () => expect(getReactionEmoji('congrats')).toBe('\u{1F389}'));
	test('angry', () => expect(getReactionEmoji('angry')).toBe('\u{1F4A2}'));
	test('confused', () => expect(getReactionEmoji('confused')).toBe('\u{1F625}'));
	test('rip', () => expect(getReactionEmoji('rip')).toBe('\u{1F607}'));
	test('pudding', () => expect(getReactionEmoji('pudding')).toBe('\u{1F36E}'));
	test('star', () => expect(getReactionEmoji('star')).toBe('\u{2B50}'));
	test('unknown reaction returns as-is', () => expect(getReactionEmoji('unknown')).toBe('unknown'));
	test('emoji reaction returns as-is', () => expect(getReactionEmoji('\u{1F600}')).toBe('\u{1F600}'));
});
