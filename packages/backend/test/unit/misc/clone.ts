/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { deepClone } from '@/misc/clone.js';

describe('misc:clone', () => {
	test('primitive string', () => {
		expect(deepClone('hello')).toBe('hello');
	});

	test('primitive number', () => {
		expect(deepClone(42)).toBe(42);
	});

	test('primitive boolean', () => {
		expect(deepClone(true)).toBe(true);
	});

	test('null', () => {
		expect(deepClone(null)).toBe(null);
	});

	test('undefined', () => {
		expect(deepClone(undefined)).toBe(undefined);
	});

	test('simple object', () => {
		const original = { a: 1, b: 'hello' };
		const cloned = deepClone(original);
		expect(cloned).toEqual(original);
		expect(cloned).not.toBe(original);
	});

	test('nested object', () => {
		const original = { a: { b: { c: 1 } } };
		const cloned = deepClone(original);
		expect(cloned).toEqual(original);
		expect(cloned.a).not.toBe(original.a);
		expect(cloned.a.b).not.toBe(original.a.b);
	});

	test('array', () => {
		const original = [1, 2, 3];
		const cloned = deepClone(original);
		expect(cloned).toEqual(original);
		expect(cloned).not.toBe(original);
	});

	test('nested array', () => {
		const original = [[1, 2], [3, 4]];
		const cloned = deepClone(original);
		expect(cloned).toEqual(original);
		expect(cloned[0]).not.toBe(original[0]);
	});

	test('object with undefined value', () => {
		const original = { a: undefined, b: 1 };
		const cloned = deepClone(original);
		expect(cloned.a).toBe(undefined);
		expect(cloned.b).toBe(1);
	});

	test('mixed object and array', () => {
		const original = { a: [1, { b: 2 }], c: 'test' };
		const cloned = deepClone(original);
		expect(cloned).toEqual(original);
		expect(cloned.a).not.toBe(original.a);
	});
});
