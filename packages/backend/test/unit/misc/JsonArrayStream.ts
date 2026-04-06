/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { JsonArrayStream } from '@/misc/JsonArrayStream.js';

describe('misc:JsonArrayStream', () => {
	test('produces valid JSON array from multiple items', async () => {
		const stream = new JsonArrayStream();
		const writer = stream.writable.getWriter();
		const chunks: string[] = [];

		// Read and write concurrently to avoid backpressure deadlock
		const readPromise = (async () => {
			const reader = stream.readable.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
		})();

		await writer.write({ a: 1 });
		await writer.write({ b: 2 });
		await writer.close();

		await readPromise;
		const result = chunks.join('');
		expect(JSON.parse(result)).toEqual([{ a: 1 }, { b: 2 }]);
	});

	test('produces valid JSON array from single item', async () => {
		const stream = new JsonArrayStream();
		const writer = stream.writable.getWriter();
		const chunks: string[] = [];

		const readPromise = (async () => {
			const reader = stream.readable.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
		})();

		await writer.write('hello');
		await writer.close();

		await readPromise;
		const result = chunks.join('');
		expect(JSON.parse(result)).toEqual(['hello']);
	});

	test('produces empty array when no items', async () => {
		const stream = new JsonArrayStream();
		const writer = stream.writable.getWriter();
		const chunks: string[] = [];

		const readPromise = (async () => {
			const reader = stream.readable.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
		})();

		await writer.close();

		await readPromise;
		const result = chunks.join('');
		expect(JSON.parse(result)).toEqual([]);
	});
});
