/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { generateInviteCode } from '@/misc/generate-invite-code.js';

describe('misc:generate-invite-code', () => {
	test('generates a non-empty string', () => {
		const code = generateInviteCode();
		expect(typeof code).toBe('string');
		expect(code.length).toBeGreaterThan(0);
	});

	test('contains only valid characters (no 0, 1, I, O)', () => {
		const code = generateInviteCode();
		expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
	});

	test('generates unique codes', () => {
		const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
		expect(codes.size).toBe(100);
	});

	test('code length is at least 8 characters', () => {
		const code = generateInviteCode();
		expect(code.length).toBeGreaterThanOrEqual(8);
	});
});
