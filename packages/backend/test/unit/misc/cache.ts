/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, jest, beforeEach, afterAll } from '@jest/globals';
import Redis from 'ioredis';
import { MemoryKVCache, MemorySingleCache, RedisKVCache, RedisSingleCache } from '@/misc/cache.js';

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

	describe('RedisKVCache', () => {
		const redis = new Redis({ host: '127.0.0.1', port: 56312 });
		let cache: RedisKVCache<string>;

		beforeEach(() => {
			cache = new RedisKVCache<string>(redis, `test-kv-${Date.now()}`, {
				lifetime: 5000,
				memoryCacheLifetime: 1000,
				fetcher: async (key) => `fetched-${key}`,
				toRedisConverter: (v) => v,
				fromRedisConverter: (v) => v,
			});
		});

		afterAll(async () => {
			cache.dispose();
			await redis.quit();
		});

		test('set and get', async () => {
			await cache.set('k1', 'v1');
			const result = await cache.get('k1');
			expect(result).toBe('v1');
		});

		test('get returns undefined for missing key', async () => {
			const result = await cache.get('nonexistent');
			expect(result).toBeUndefined();
		});

		test('delete removes entry', async () => {
			await cache.set('k1', 'v1');
			await cache.delete('k1');
			const result = await cache.get('k1');
			expect(result).toBeUndefined();
		});

		test('fetch uses cache on hit', async () => {
			await cache.set('k1', 'cached');
			const result = await cache.fetch('k1');
			expect(result).toBe('cached');
		});

		test('fetch calls fetcher on miss', async () => {
			const result = await cache.fetch('missing-key');
			expect(result).toBe('fetched-missing-key');
		});

		test('refresh updates cache', async () => {
			await cache.set('k1', 'old');
			await cache.refresh('k1');
			const result = await cache.get('k1');
			expect(result).toBe('fetched-k1');
		});

		test('gc does not throw', () => {
			expect(() => cache.gc()).not.toThrow();
		});

		test('set with Infinity lifetime', async () => {
			const infCache = new RedisKVCache<string>(redis, `test-inf-${Date.now()}`, {
				lifetime: Infinity,
				memoryCacheLifetime: 1000,
				fetcher: async () => 'val',
				toRedisConverter: (v) => v,
				fromRedisConverter: (v) => v,
			});
			await infCache.set('k', 'v');
			const result = await infCache.get('k');
			expect(result).toBe('v');
			infCache.dispose();
		});
	});

	describe('RedisSingleCache', () => {
		const redis = new Redis({ host: '127.0.0.1', port: 56312 });
		let cache: RedisSingleCache<string>;

		beforeEach(() => {
			cache = new RedisSingleCache<string>(redis, `test-single-${Date.now()}`, {
				lifetime: 5000,
				memoryCacheLifetime: 1000,
				fetcher: async () => 'fetched-value',
				toRedisConverter: (v) => v,
				fromRedisConverter: (v) => v,
			});
		});

		afterAll(async () => {
			await redis.quit();
		});

		test('set and get', async () => {
			await cache.set('v1');
			const result = await cache.get();
			expect(result).toBe('v1');
		});

		test('get returns undefined when empty', async () => {
			const result = await cache.get();
			expect(result).toBeUndefined();
		});

		test('delete clears value', async () => {
			await cache.set('v1');
			await cache.delete();
			const result = await cache.get();
			expect(result).toBeUndefined();
		});

		test('fetch calls fetcher on miss', async () => {
			const result = await cache.fetch();
			expect(result).toBe('fetched-value');
		});

		test('refresh updates value', async () => {
			await cache.set('old');
			await cache.refresh();
			const result = await cache.get();
			expect(result).toBe('fetched-value');
		});

		test('set with Infinity lifetime', async () => {
			const infCache = new RedisSingleCache<string>(redis, `test-single-inf-${Date.now()}`, {
				lifetime: Infinity,
				memoryCacheLifetime: 1000,
				fetcher: async () => 'val',
				toRedisConverter: (v) => v,
				fromRedisConverter: (v) => v,
			});
			await infCache.set('v');
			const result = await infCache.get();
			expect(result).toBe('v');
		});
	});
});
