/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import {
	countIf, count, concat, intersperse, erase,
	difference, unique, sum, maximum, lessThan,
	takeWhile, cumulativeSum, toArray, toSingle,
} from '@/misc/prelude/array.js';

describe('misc:prelude:array', () => {
	test('countIf', () => {
		expect(countIf(x => x > 2, [1, 2, 3, 4])).toBe(2);
		expect(countIf(x => x > 10, [1, 2, 3])).toBe(0);
	});

	test('count', () => {
		expect(count(1, [1, 2, 1, 3, 1])).toBe(3);
		expect(count(5, [1, 2, 3])).toBe(0);
	});

	test('concat', () => {
		expect(concat([[1, 2], [3, 4], [5]])).toEqual([1, 2, 3, 4, 5]);
		expect(concat([])).toEqual([]);
	});

	test('intersperse', () => {
		expect(intersperse(0, [1, 2, 3])).toEqual([1, 0, 2, 0, 3]);
		expect(intersperse(0, [1])).toEqual([1]);
		expect(intersperse(0, [])).toEqual([]);
	});

	test('erase', () => {
		expect(erase(2, [1, 2, 3, 2, 4])).toEqual([1, 3, 4]);
		expect(erase(5, [1, 2, 3])).toEqual([1, 2, 3]);
	});

	test('difference', () => {
		expect(difference([1, 2, 3, 4], [2, 4])).toEqual([1, 3]);
		expect(difference([1, 2], [3, 4])).toEqual([1, 2]);
	});

	test('unique', () => {
		expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
		expect(unique([])).toEqual([]);
	});

	test('sum', () => {
		expect(sum([1, 2, 3])).toBe(6);
		expect(sum([])).toBe(0);
	});

	test('maximum', () => {
		expect(maximum([1, 5, 3])).toBe(5);
	});

	test('lessThan', () => {
		expect(lessThan([1, 2], [1, 3])).toBe(true);
		expect(lessThan([1, 3], [1, 2])).toBe(false);
		expect(lessThan([1], [1, 2])).toBe(true);
		expect(lessThan([1, 2], [1])).toBe(false);
		expect(lessThan([1, 2], [1, 2])).toBe(false);
	});

	test('takeWhile', () => {
		expect(takeWhile(x => x < 3, [1, 2, 3, 4])).toEqual([1, 2]);
		expect(takeWhile(x => x < 10, [1, 2, 3])).toEqual([1, 2, 3]);
		expect(takeWhile(x => x < 0, [1, 2, 3])).toEqual([]);
	});

	test('cumulativeSum', () => {
		expect(cumulativeSum([1, 2, 3, 4])).toEqual([1, 3, 6, 10]);
		expect(cumulativeSum([])).toEqual([]);
	});

	test('toArray', () => {
		expect(toArray([1, 2])).toEqual([1, 2]);
		expect(toArray(1)).toEqual([1]);
		expect(toArray(undefined)).toEqual([]);
	});

	test('toSingle', () => {
		expect(toSingle([1, 2, 3])).toBe(1);
		expect(toSingle(42)).toBe(42);
		expect(toSingle(undefined)).toBeUndefined();
	});
});
