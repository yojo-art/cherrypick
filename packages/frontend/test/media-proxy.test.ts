/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert } from 'vitest';
import { MediaProxy } from '@@/js/media-proxy.js';

describe('MediaProxy', () => {
	const baseUrl = 'https://example.com';
	const mediaProxy = 'https://proxy.example.com';
	const meta = { mediaProxy } as ConstructorParameters<typeof MediaProxy>[0];
	const mp = new MediaProxy(meta, baseUrl);

	describe('getAvatarUrl', () => {
		test('same-origin identicon is returned as absolute URL without proxy', () => {
			assert.strictEqual(
				mp.getAvatarUrl('/identicon/abc'),
				'https://example.com/identicon/abc',
			);
			assert.strictEqual(
				mp.getAvatarUrl('https://example.com/identicon/abc'),
				'https://example.com/identicon/abc',
			);
		});

		test('same-origin /avatar/ is not proxied', () => {
			const url = `${baseUrl}/avatar/@user@host`;
			assert.strictEqual(mp.getAvatarUrl(url), url);
		});

		test('same-origin /static-assets/ is not proxied', () => {
			const url = `${baseUrl}/static-assets/dummy.png`;
			assert.strictEqual(mp.getAvatarUrl(url), url);
			assert.strictEqual(
				mp.getAvatarUrl('/static-assets/dummy.png'),
				'https://example.com/static-assets/dummy.png',
			);
		});

		test('other-origin identicon is proxied with avatar=1', () => {
			const result = mp.getAvatarUrl('https://other.example/identicon/x');
			assert.ok(result.startsWith(`${mediaProxy}/image.webp?`));
			assert.ok(result.includes('avatar=1'));
			assert.ok(result.includes(`url=${encodeURIComponent('https://other.example/identicon/x')}`));
			assert.ok(result.includes('fallback=1'));
		});

		test('external avatar is proxied with avatar=1', () => {
			const result = mp.getAvatarUrl('https://cdn.example/a.png');
			assert.ok(result.startsWith(`${mediaProxy}/image.webp?`));
			assert.ok(result.includes('avatar=1'));
			assert.ok(result.includes(`url=${encodeURIComponent('https://cdn.example/a.png')}`));
			assert.ok(result.includes('fallback=1'));
		});

		test('isStatic=true proxies external URL as static.webp', () => {
			const result = mp.getAvatarUrl('https://cdn.example/a.png', true);
			assert.ok(result.startsWith(`${mediaProxy}/static.webp?`));
			assert.ok(result.includes('static=1'));
			assert.ok(result.includes(`url=${encodeURIComponent('https://cdn.example/a.png')}`));
		});

		test('isStatic=true does not proxy local avatar endpoints', () => {
			assert.strictEqual(
				mp.getAvatarUrl('/identicon/abc', true),
				'https://example.com/identicon/abc',
			);
		});

		test('already-proxied URL is unwrapped and rebuilt', () => {
			const original = 'https://cdn.example/a.png';
			const alreadyProxied = `${mediaProxy}/image.webp?url=${encodeURIComponent(original)}&avatar=1&fallback=1`;
			const result = mp.getAvatarUrl(alreadyProxied);
			assert.ok(result.startsWith(`${mediaProxy}/image.webp?`));
			assert.ok(result.includes('avatar=1'));
			assert.ok(result.includes(`url=${encodeURIComponent(original)}`));
		});

		test('invalid URL falls through to proxy path', () => {
			const result = mp.getAvatarUrl('not a url');
			assert.ok(result.startsWith(`${mediaProxy}/image.webp?`));
			assert.ok(result.includes('avatar=1'));
		});
	});

	describe('getAvatarUrlNullable', () => {
		test('returns null for nullish', () => {
			assert.strictEqual(mp.getAvatarUrlNullable(null), null);
			assert.strictEqual(mp.getAvatarUrlNullable(undefined), null);
		});

		test('delegates to getAvatarUrl for string', () => {
			assert.strictEqual(
				mp.getAvatarUrlNullable('/identicon/abc'),
				'https://example.com/identicon/abc',
			);
		});
	});
});
