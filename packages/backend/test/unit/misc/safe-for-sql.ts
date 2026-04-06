/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { safeForSql } from '@/misc/safe-for-sql.js';

describe('misc:safe-for-sql', () => {
	test('safe plain text', () => {
		expect(safeForSql('hello world')).toBe(true);
	});

	test('safe alphanumeric', () => {
		expect(safeForSql('abc123')).toBe(true);
	});

	test('unsafe: single quote', () => {
		expect(safeForSql("it's")).toBe(false);
	});

	test('unsafe: double quote', () => {
		expect(safeForSql('say "hello"')).toBe(false);
	});

	test('unsafe: backslash', () => {
		expect(safeForSql('path\\to')).toBe(false);
	});

	test('unsafe: percent', () => {
		expect(safeForSql('100%')).toBe(false);
	});

	test('unsafe: newline', () => {
		expect(safeForSql('line1\nline2')).toBe(false);
	});

	test('unsafe: carriage return', () => {
		expect(safeForSql('line1\rline2')).toBe(false);
	});

	test('unsafe: null byte', () => {
		expect(safeForSql('null\0byte')).toBe(false);
	});

	test('empty string is safe', () => {
		expect(safeForSql('')).toBe(true);
	});
});
