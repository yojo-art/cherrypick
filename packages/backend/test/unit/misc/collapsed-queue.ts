/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, jest } from '@jest/globals';
import { CollapsedQueue } from '@/misc/collapsed-queue.js';

describe('misc:collapsed-queue', () => {
	test('enqueue and perform after timeout', async () => {
		const performed: [string, number][] = [];
		const queue = new CollapsedQueue<string, number>(
			50,
			(old, next) => old + next,
			async (key, value) => { performed.push([key, value]); },
		);

		queue.enqueue('a', 1);
		expect(performed).toHaveLength(0);

		await new Promise(resolve => setTimeout(resolve, 100));
		expect(performed).toEqual([['a', 1]]);
	});

	test('collapse merges values before performing', async () => {
		const performed: [string, number][] = [];
		const queue = new CollapsedQueue<string, number>(
			100,
			(old, next) => old + next,
			async (key, value) => { performed.push([key, value]); },
		);

		queue.enqueue('a', 1);
		queue.enqueue('a', 2);
		queue.enqueue('a', 3);

		await new Promise(resolve => setTimeout(resolve, 200));
		expect(performed).toEqual([['a', 6]]);
	});

	test('different keys are independent', async () => {
		const performed: [string, number][] = [];
		const queue = new CollapsedQueue<string, number>(
			50,
			(old, next) => old + next,
			async (key, value) => { performed.push([key, value]); },
		);

		queue.enqueue('a', 1);
		queue.enqueue('b', 2);

		await new Promise(resolve => setTimeout(resolve, 100));
		expect(performed).toContainEqual(['a', 1]);
		expect(performed).toContainEqual(['b', 2]);
	});

	test('performAllNow executes all immediately', async () => {
		const performed: [string, number][] = [];
		const queue = new CollapsedQueue<string, number>(
			10000,
			(old, next) => old + next,
			async (key, value) => { performed.push([key, value]); },
		);

		queue.enqueue('a', 1);
		queue.enqueue('b', 2);

		await queue.performAllNow();
		expect(performed).toContainEqual(['a', 1]);
		expect(performed).toContainEqual(['b', 2]);
	});
});
