/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { MemoryKVCache, MemorySingleCache } from '@/misc/cache.js';

describe('misc:cache', () => {
	describe('MemoryKVCache', () => {
		let cache: MemoryKVCache<string>;

		beforeEach(() => {
			cache = new MemoryKVCache<string>(1000);
		});

		test('set and get', () => {
			cache.set('key1', 'value1');
			expect(cache.get('key1')).toBe('value1');
		});

		test('get returns undefined for missing key', () => {
			expect(cache.get('missing')).toBeUndefined();
		});

		test('delete removes entry', () => {
			cache.set('key1', 'value1');
			cache.delete('key1');
			expect(cache.get('key1')).toBeUndefined();
		});

		test('expired entry returns undefined', async () => {
			const shortCache = new MemoryKVCache<string>(1);
			shortCache.set('key1', 'value1');
			await new Promise(resolve => setTimeout(resolve, 10));
			expect(shortCache.get('key1')).toBeUndefined();
			shortCache.dispose();
		});

		test('fetch calls fetcher on cache miss', async () => {
			const fetcher = jest.fn(async () => 'fetched');
			const result = await cache.fetch('key1', fetcher);
			expect(result).toBe('fetched');
			expect(fetcher).toHaveBeenCalled();
		});

		test('fetch returns cached value on cache hit', async () => {
			cache.set('key1', 'cached');
			const fetcher = jest.fn(async () => 'fetched');
			const result = await cache.fetch('key1', fetcher);
			expect(result).toBe('cached');
			expect(fetcher).not.toHaveBeenCalled();
		});

		test('fetch with validator invalidates cache', async () => {
			cache.set('key1', 'old');
			const fetcher = jest.fn(async () => 'new');
			const result = await cache.fetch('key1', fetcher, () => false);
			expect(result).toBe('new');
			expect(fetcher).toHaveBeenCalled();
		});

		test('fetch with validator keeps valid cache', async () => {
			cache.set('key1', 'valid');
			const fetcher = jest.fn(async () => 'new');
			const result = await cache.fetch('key1', fetcher, () => true);
			expect(result).toBe('valid');
			expect(fetcher).not.toHaveBeenCalled();
		});

		test('fetchMaybe returns undefined when fetcher returns undefined', async () => {
			const result = await cache.fetchMaybe('key1', async () => undefined);
			expect(result).toBeUndefined();
		});

		test('fetchMaybe caches non-undefined value', async () => {
			await cache.fetchMaybe('key1', async () => 'value');
			expect(cache.get('key1')).toBe('value');
		});

		test('fetchMaybe with validator invalidates cache', async () => {
			cache.set('key1', 'old');
			const result = await cache.fetchMaybe('key1', async () => 'new', () => false);
			expect(result).toBe('new');
		});

		test('fetchMaybe with validator keeps valid cache', async () => {
			cache.set('key1', 'valid');
			const result = await cache.fetchMaybe('key1', async () => 'new', () => true);
			expect(result).toBe('valid');
		});

		test('gc removes expired entries', async () => {
			const shortCache = new MemoryKVCache<string>(1);
			shortCache.set('key1', 'value1');
			await new Promise(resolve => setTimeout(resolve, 10));
			shortCache.gc();
			expect(shortCache.get('key1')).toBeUndefined();
			shortCache.dispose();
		});

		test('entries returns map entries', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');
			const entries = [...cache.entries];
			expect(entries).toHaveLength(2);
		});

		test('dispose clears interval', () => {
			cache.dispose();
			// no error means success
		});
	});

	describe('MemorySingleCache', () => {
		let cache: MemorySingleCache<string>;

		beforeEach(() => {
			cache = new MemorySingleCache<string>(1000);
		});

		test('set and get', () => {
			cache.set('value1');
			expect(cache.get()).toBe('value1');
		});

		test('get returns undefined when empty', () => {
			expect(cache.get()).toBeUndefined();
		});

		test('delete clears value', () => {
			cache.set('value1');
			cache.delete();
			expect(cache.get()).toBeUndefined();
		});

		test('expired value returns undefined', async () => {
			const shortCache = new MemorySingleCache<string>(1);
			shortCache.set('value1');
			await new Promise(resolve => setTimeout(resolve, 10));
			expect(shortCache.get()).toBeUndefined();
		});

		test('fetch calls fetcher on cache miss', async () => {
			const fetcher = jest.fn(async () => 'fetched');
			const result = await cache.fetch(fetcher);
			expect(result).toBe('fetched');
			expect(fetcher).toHaveBeenCalled();
		});

		test('fetch returns cached value on cache hit', async () => {
			cache.set('cached');
			const fetcher = jest.fn(async () => 'fetched');
			const result = await cache.fetch(fetcher);
			expect(result).toBe('cached');
			expect(fetcher).not.toHaveBeenCalled();
		});

		test('fetch with validator invalidates cache', async () => {
			cache.set('old');
			const result = await cache.fetch(async () => 'new', () => false);
			expect(result).toBe('new');
		});

		test('fetch with validator keeps valid cache', async () => {
			cache.set('valid');
			const result = await cache.fetch(async () => 'new', () => true);
			expect(result).toBe('valid');
		});

		test('fetchMaybe returns undefined when fetcher returns undefined', async () => {
			const result = await cache.fetchMaybe(async () => undefined);
			expect(result).toBeUndefined();
		});

		test('fetchMaybe caches non-undefined value', async () => {
			await cache.fetchMaybe(async () => 'value');
			expect(cache.get()).toBe('value');
		});

		test('fetchMaybe with validator invalidates cache', async () => {
			cache.set('old');
			const result = await cache.fetchMaybe(async () => 'new', () => false);
			expect(result).toBe('new');
		});

		test('fetchMaybe with validator keeps valid cache', async () => {
			cache.set('valid');
			const result = await cache.fetchMaybe(async () => 'new', () => true);
			expect(result).toBe('valid');
		});
	});
});
