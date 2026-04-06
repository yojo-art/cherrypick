/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import type { Predicate, Relation, EndoRelation } from '@/misc/prelude/relation.js';

describe('misc:prelude:relation', () => {
	test('Predicate type works', () => {
		const isPositive: Predicate<number> = (a) => a > 0;
		expect(isPositive(1)).toBe(true);
		expect(isPositive(-1)).toBe(false);
	});

	test('Relation type works', () => {
		const isGreater: Relation<number, number> = (a, b) => a > b;
		expect(isGreater(2, 1)).toBe(true);
		expect(isGreater(1, 2)).toBe(false);
	});

	test('EndoRelation type works', () => {
		const isEqual: EndoRelation<string> = (a, b) => a === b;
		expect(isEqual('a', 'a')).toBe(true);
		expect(isEqual('a', 'b')).toBe(false);
	});
});
