/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { escapeValue, escapeAttribute } from '@/misc/prelude/xml.js';

describe('misc:prelude:xml', () => {
	describe('escapeValue', () => {
		test('escapes ampersand', () => {
			expect(escapeValue('a&b')).toBe('a&amp;b');
		});

		test('escapes less than', () => {
			expect(escapeValue('a<b')).toBe('a&lt;b');
		});

		test('escapes greater than', () => {
			expect(escapeValue('a>b')).toBe('a&gt;b');
		});

		test('escapes double quote', () => {
			expect(escapeValue('a"b')).toBe('a&quot;b');
		});

		test('escapes single quote', () => {
			expect(escapeValue("a'b")).toBe('a&apos;b');
		});

		test('plain text is unchanged', () => {
			expect(escapeValue('hello world')).toBe('hello world');
		});

		test('empty string', () => {
			expect(escapeValue('')).toBe('');
		});
	});

	describe('escapeAttribute', () => {
		test('escapes ampersand', () => {
			expect(escapeAttribute('a&b')).toBe('a&amp;b');
		});

		test('escapes less than', () => {
			expect(escapeAttribute('a<b')).toBe('a&lt;b');
		});

		test('plain text is unchanged', () => {
			expect(escapeAttribute('hello')).toBe('hello');
		});
	});
});
