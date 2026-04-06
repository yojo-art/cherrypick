/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { parse, toString } from '@/misc/acct.js';

describe('misc:acct', () => {
	describe('parse', () => {
		test('username only', () => {
			expect(parse('alice')).toEqual({ username: 'alice', host: null });
		});

		test('username with host', () => {
			expect(parse('alice@example.com')).toEqual({ username: 'alice', host: 'example.com' });
		});

		test('leading @', () => {
			expect(parse('@alice')).toEqual({ username: 'alice', host: null });
		});

		test('leading @ with host', () => {
			expect(parse('@alice@example.com')).toEqual({ username: 'alice', host: 'example.com' });
		});
	});

	describe('toString', () => {
		test('local user (host is null)', () => {
			expect(toString({ username: 'alice', host: null })).toBe('alice');
		});

		test('remote user', () => {
			expect(toString({ username: 'alice', host: 'example.com' })).toBe('alice@example.com');
		});
	});
});
