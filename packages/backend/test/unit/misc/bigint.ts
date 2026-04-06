/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { parseBigInt36, parseBigInt16, parseBigInt32, parseBigIntCrockfordBase32 } from '@/misc/bigint.js';

describe('misc:bigint', () => {
	describe('parseBigInt36', () => {
		test('zero', () => {
			expect(parseBigInt36('0')).toBe(0n);
		});

		test('simple value', () => {
			expect(parseBigInt36('1')).toBe(1n);
		});

		test('larger value', () => {
			expect(parseBigInt36('zzzz')).toBe(36n ** 4n - 1n);
		});

		test('long string (multi-chunk)', () => {
			// 11 chars will cause chunking (chunk size is 10)
			const val = parseBigInt36('10000000000');
			expect(val).toBe(36n ** 10n);
		});

		test('throws on invalid character', () => {
			expect(() => parseBigInt36('!')).toThrow('Invalid base36 string');
		});
	});

	describe('parseBigInt16', () => {
		test('zero', () => {
			expect(parseBigInt16('0')).toBe(0n);
		});

		test('hex value ff', () => {
			expect(parseBigInt16('ff')).toBe(255n);
		});

		test('long string (multi-chunk)', () => {
			// 14 chars triggers chunking (chunk size is 13)
			const val = parseBigInt16('10000000000000');
			expect(val).toBe(16n ** 13n);
		});
	});

	describe('parseBigInt32', () => {
		test('zero', () => {
			expect(parseBigInt32('0')).toBe(0n);
		});

		test('simple value', () => {
			expect(parseBigInt32('v')).toBe(31n);
		});

		test('long string (multi-chunk)', () => {
			const val = parseBigInt32('10000000000');
			expect(val).toBe(32n ** 10n);
		});
	});

	describe('parseBigIntCrockfordBase32', () => {
		test('zero', () => {
			expect(parseBigIntCrockfordBase32('0')).toBe(0n);
		});

		test('simple value', () => {
			// Crockford 'A' = standard '0'+10 = 10
			expect(parseBigIntCrockfordBase32('A')).toBe(10n);
		});

		test('throws on invalid Crockford character', () => {
			// 'U' is not in Crockford Base32 alphabet
			expect(() => parseBigIntCrockfordBase32('U')).toThrow('Invalid Crockford Base32 character');
		});
	});
});
