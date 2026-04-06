/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { trackPromise, allSettled } from '@/misc/promise-tracker.js';

describe('misc:promise-tracker', () => {
	test('trackPromise and allSettled work together', async () => {
		let resolved = false;
		const promise = new Promise<void>(resolve => {
			setTimeout(() => {
				resolved = true;
				resolve();
			}, 10);
		});

		trackPromise(promise);
		await allSettled();
		expect(resolved).toBe(true);
	});

	test('allSettled resolves with no tracked promises', async () => {
		await allSettled();
	});
});
