/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { genIdenticon } from '@/misc/gen-identicon.js';

describe('misc:gen-identicon', () => {
	test('generates a PNG buffer', async () => {
		const buf = await genIdenticon('test-seed');
		expect(buf).toBeInstanceOf(Buffer);
		// PNG magic bytes
		expect(buf[0]).toBe(0x89);
		expect(buf[1]).toBe(0x50);
		expect(buf[2]).toBe(0x4E);
		expect(buf[3]).toBe(0x47);
	});

	test('same seed produces same output', async () => {
		const buf1 = await genIdenticon('same-seed');
		const buf2 = await genIdenticon('same-seed');
		expect(buf1.equals(buf2)).toBe(true);
	});

	test('different seeds produce different output', async () => {
		const buf1 = await genIdenticon('seed-a');
		const buf2 = await genIdenticon('seed-b');
		expect(buf1.equals(buf2)).toBe(false);
	});
});
