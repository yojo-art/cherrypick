/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { isInstanceMuted, isUserFromMutedInstance } from '@/misc/is-instance-muted.js';

describe('misc:is-instance-muted', () => {
	const mutedInstances = new Set(['muted.example.com', 'blocked.example.org']);

	describe('isInstanceMuted', () => {
		test('not muted when user host is not in set', () => {
			const note = { user: { host: 'safe.example.com' } } as any;
			expect(isInstanceMuted(note, mutedInstances)).toBe(false);
		});

		test('muted when user host matches', () => {
			const note = { user: { host: 'muted.example.com' } } as any;
			expect(isInstanceMuted(note, mutedInstances)).toBe(true);
		});

		test('muted when reply user host matches', () => {
			const note = {
				user: { host: 'safe.example.com' },
				reply: { user: { host: 'muted.example.com' } },
			} as any;
			expect(isInstanceMuted(note, mutedInstances)).toBe(true);
		});

		test('muted when renote user host matches', () => {
			const note = {
				user: { host: 'safe.example.com' },
				renote: { user: { host: 'blocked.example.org' } },
			} as any;
			expect(isInstanceMuted(note, mutedInstances)).toBe(true);
		});

		test('not muted when all hosts are safe', () => {
			const note = {
				user: { host: 'safe.example.com' },
				reply: { user: { host: 'other.example.com' } },
				renote: { user: { host: 'another.example.com' } },
			} as any;
			expect(isInstanceMuted(note, mutedInstances)).toBe(false);
		});

		test('not muted when hosts are null (local user)', () => {
			const note = {
				user: { host: null },
				reply: null,
				renote: null,
			} as any;
			expect(isInstanceMuted(note, mutedInstances)).toBe(false);
		});
	});

	describe('isUserFromMutedInstance', () => {
		test('muted when user host matches', () => {
			const notif = { user: { host: 'muted.example.com' } } as any;
			expect(isUserFromMutedInstance(notif, mutedInstances)).toBe(true);
		});

		test('not muted when user host does not match', () => {
			const notif = { user: { host: 'safe.example.com' } } as any;
			expect(isUserFromMutedInstance(notif, mutedInstances)).toBe(false);
		});

		test('not muted when user host is null', () => {
			const notif = { user: { host: null } } as any;
			expect(isUserFromMutedInstance(notif, mutedInstances)).toBe(false);
		});
	});
});
