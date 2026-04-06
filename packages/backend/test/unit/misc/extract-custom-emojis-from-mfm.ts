/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import * as mfm from 'mfc-js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';

describe('misc:extract-custom-emojis-from-mfm', () => {
	test('extracts emoji codes', () => {
		const nodes = mfm.parse(':emoji1: :emoji2:');
		const result = extractCustomEmojisFromMfm(nodes);
		expect(result).toContain('emoji1');
		expect(result).toContain('emoji2');
	});

	test('no emojis returns empty array', () => {
		const nodes = mfm.parse('Hello world');
		expect(extractCustomEmojisFromMfm(nodes)).toEqual([]);
	});

	test('deduplicates emoji codes', () => {
		const nodes = mfm.parse(':same: :same: :same:');
		const result = extractCustomEmojisFromMfm(nodes);
		expect(result).toEqual(['same']);
	});

	test('ignores emoji names longer than 100 chars', () => {
		const longName = 'a'.repeat(101);
		const nodes = mfm.parse(`:${longName}:`);
		expect(extractCustomEmojisFromMfm(nodes)).toEqual([]);
	});
});
