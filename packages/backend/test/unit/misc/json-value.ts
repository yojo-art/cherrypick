/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { isJsonObject } from '@/misc/json-value.js';

describe('misc:json-value', () => {
	test('plain object returns true', () => {
		expect(isJsonObject({ key: 'value' })).toBe(true);
	});

	test('empty object returns true', () => {
		expect(isJsonObject({})).toBe(true);
	});

	test('null returns false', () => {
		expect(isJsonObject(null)).toBe(false);
	});

	test('array returns false', () => {
		expect(isJsonObject([1, 2, 3])).toBe(false);
	});

	test('string returns false', () => {
		expect(isJsonObject('hello' as any)).toBe(false);
	});

	test('number returns false', () => {
		expect(isJsonObject(42 as any)).toBe(false);
	});

	test('boolean returns false', () => {
		expect(isJsonObject(true as any)).toBe(false);
	});

	test('undefined returns false', () => {
		expect(isJsonObject(undefined)).toBe(false);
	});
});
