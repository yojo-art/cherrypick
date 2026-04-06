/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { genAidx, parseAidx, parseAidxFull, isSafeAidxT, aidxRegExp } from '@/misc/id/aidx.js';
import { genAid, parseAid, parseAidFull, isSafeAidT, aidRegExp } from '@/misc/id/aid.js';
import { genMeid, parseMeid, parseMeidFull, isSafeMeidT, meidRegExp } from '@/misc/id/meid.js';
import { genMeidg, parseMeidg, parseMeidgFull, isSafeMeidgT, meidgRegExp } from '@/misc/id/meidg.js';
import { genObjectId, parseObjectId, parseObjectIdFull, isSafeObjectIdT, objectIdRegExp } from '@/misc/id/object-id.js';
import { parseUlid, parseUlidFull, ulidRegExp } from '@/misc/id/ulid.js';

describe('misc:id', () => {
	const now = Date.now();

	describe('aidx', () => {
		test('genAidx produces valid format', () => {
			const id = genAidx(now);
			expect(id).toMatch(aidxRegExp);
			expect(id).toHaveLength(16);
		});

		test('parseAidx extracts date', () => {
			const id = genAidx(now);
			const parsed = parseAidx(id);
			expect(Math.abs(parsed.date.getTime() - now)).toBeLessThan(1000);
		});

		test('parseAidxFull extracts date and additional', () => {
			const id = genAidx(now);
			const parsed = parseAidxFull(id);
			expect(typeof parsed.date).toBe('number');
			expect(typeof parsed.additional).toBe('bigint');
		});

		test('isSafeAidxT', () => {
			expect(isSafeAidxT(now)).toBe(true);
			expect(isSafeAidxT(0)).toBe(false);
		});

		test('genAidx throws on NaN', () => {
			expect(() => genAidx(NaN)).toThrow('Invalid Date');
		});

		test('genAidx with time before 2000 returns padded value', () => {
			const id = genAidx(0);
			expect(id).toMatch(aidxRegExp);
		});
	});

	describe('aid', () => {
		test('genAid produces valid format', () => {
			const id = genAid(now);
			expect(id).toMatch(aidRegExp);
			expect(id).toHaveLength(10);
		});

		test('parseAid extracts date', () => {
			const id = genAid(now);
			const parsed = parseAid(id);
			expect(Math.abs(parsed.date.getTime() - now)).toBeLessThan(1000);
		});

		test('parseAidFull extracts date and additional', () => {
			const id = genAid(now);
			const parsed = parseAidFull(id);
			expect(typeof parsed.date).toBe('number');
			expect(typeof parsed.additional).toBe('bigint');
		});

		test('isSafeAidT', () => {
			expect(isSafeAidT(now)).toBe(true);
			expect(isSafeAidT(0)).toBe(false);
		});

		test('genAid throws on NaN', () => {
			expect(() => genAid(NaN)).toThrow('Invalid Date');
		});
	});

	describe('meid', () => {
		test('genMeid produces valid format', () => {
			const id = genMeid(now);
			expect(id).toMatch(meidRegExp);
			expect(id).toHaveLength(24);
		});

		test('parseMeid extracts date', () => {
			const id = genMeid(now);
			const parsed = parseMeid(id);
			expect(Math.abs(parsed.date.getTime() - now)).toBeLessThan(1000);
		});

		test('parseMeidFull extracts date and additional', () => {
			const id = genMeid(now);
			const parsed = parseMeidFull(id);
			expect(typeof parsed.date).toBe('number');
			expect(typeof parsed.additional).toBe('bigint');
		});

		test('isSafeMeidT', () => {
			expect(isSafeMeidT(now)).toBe(true);
			expect(isSafeMeidT(0)).toBe(false);
		});

		test('genMeid with time 0', () => {
			const id = genMeid(0);
			expect(id.length).toBeGreaterThan(0);
		});
	});

	describe('meidg', () => {
		test('genMeidg produces valid format', () => {
			const id = genMeidg(now);
			expect(id).toMatch(meidgRegExp);
			expect(id).toHaveLength(24);
		});

		test('parseMeidg extracts date', () => {
			const id = genMeidg(now);
			const parsed = parseMeidg(id);
			expect(Math.abs(parsed.date.getTime() - now)).toBeLessThan(1000);
		});

		test('parseMeidgFull extracts date and additional', () => {
			const id = genMeidg(now);
			const parsed = parseMeidgFull(id);
			expect(typeof parsed.date).toBe('number');
			expect(typeof parsed.additional).toBe('bigint');
		});

		test('isSafeMeidgT', () => {
			expect(isSafeMeidgT(now)).toBe(true);
			expect(isSafeMeidgT(0)).toBe(false);
		});

		test('genMeidg with time 0', () => {
			const id = genMeidg(0);
			expect(id).toMatch(/^g/);
		});
	});

	describe('objectId', () => {
		test('genObjectId produces valid format', () => {
			const id = genObjectId(now);
			expect(id).toMatch(objectIdRegExp);
			expect(id).toHaveLength(24);
		});

		test('parseObjectId extracts date', () => {
			const id = genObjectId(now);
			const parsed = parseObjectId(id);
			// objectId has second precision
			expect(Math.abs(parsed.date.getTime() - now)).toBeLessThan(2000);
		});

		test('parseObjectIdFull extracts date and additional', () => {
			const id = genObjectId(now);
			const parsed = parseObjectIdFull(id);
			expect(typeof parsed.date).toBe('number');
			expect(typeof parsed.additional).toBe('bigint');
		});

		test('isSafeObjectIdT', () => {
			expect(isSafeObjectIdT(now)).toBe(true);
			expect(isSafeObjectIdT(0)).toBe(false);
		});

		test('genObjectId with time 0', () => {
			const id = genObjectId(0);
			expect(id.length).toBeGreaterThan(0);
		});
	});

	describe('ulid', () => {
		test('ulidRegExp matches valid ULID', () => {
			expect(ulidRegExp.test('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(true);
		});

		test('parseUlid extracts date', () => {
			// Known ULID: 01ARZ3NDEK... encodes timestamp
			const parsed = parseUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV');
			expect(parsed.date).toBeInstanceOf(Date);
			expect(parsed.date.getTime()).toBeGreaterThan(0);
		});

		test('parseUlidFull extracts date and additional', () => {
			const parsed = parseUlidFull('01ARZ3NDEKTSV4RRFFQ69G5FAV');
			expect(typeof parsed.date).toBe('number');
			expect(typeof parsed.additional).toBe('bigint');
		});
	});
});
