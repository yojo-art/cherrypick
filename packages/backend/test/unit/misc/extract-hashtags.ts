/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import * as mfm from 'mfc-js';
import { extractHashtags } from '@/misc/extract-hashtags.js';

describe('misc:extract-hashtags', () => {
	test('extracts hashtags', () => {
		const nodes = mfm.parse('#hello #world');
		const result = extractHashtags(nodes);
		expect(result).toContain('hello');
		expect(result).toContain('world');
	});

	test('no hashtags returns empty array', () => {
		const nodes = mfm.parse('Hello world');
		expect(extractHashtags(nodes)).toEqual([]);
	});

	test('deduplicates hashtags', () => {
		const nodes = mfm.parse('#same #same #same');
		const result = extractHashtags(nodes);
		expect(result).toEqual(['same']);
	});
});
