/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { query, appendQuery } from '@/misc/prelude/url.js';

describe('misc:prelude:url', () => {
	describe('query', () => {
		test('simple key-value pairs', () => {
			expect(query({ a: '1', b: '2' })).toBe('a=1&b=2');
		});

		test('filters out undefined values', () => {
			expect(query({ a: '1', b: undefined })).toBe('a=1');
		});

		test('filters out empty arrays', () => {
			expect(query({ a: '1', b: [] })).toBe('a=1');
		});

		test('includes non-empty arrays', () => {
			const result = query({ a: [1, 2] });
			expect(result).toContain('a=');
		});

		test('empty object returns empty string', () => {
			expect(query({})).toBe('');
		});

		test('encodes special characters', () => {
			expect(query({ a: 'hello world' })).toBe('a=hello%20world');
		});
	});

	describe('appendQuery', () => {
		test('appends with ? for URL without query', () => {
			expect(appendQuery('https://example.com', 'a=1')).toBe('https://example.com?a=1');
		});

		test('appends with & for URL with existing query', () => {
			expect(appendQuery('https://example.com?b=2', 'a=1')).toBe('https://example.com?b=2&a=1');
		});

		test('appends without separator when URL ends with ?', () => {
			expect(appendQuery('https://example.com?', 'a=1')).toBe('https://example.com?a=1');
		});
	});
});
