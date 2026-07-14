/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, test } from '@jest/globals';
import type { Config } from '@/config.js';
import type { MiMeta } from '@/models/_.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';

function createService(
	configOverrides: Partial<Config> = {},
	metaOverrides: Partial<MiMeta> = {},
): DriveFileEntityService {
	return new DriveFileEntityService(
		{
			url: 'https://example.com',
			mediaProxy: 'https://proxy.example.com',
			externalMediaProxyEnabled: false,
			...configOverrides,
		} as Config,
		{
			proxyRemoteFiles: false,
			...metaOverrides,
		} as MiMeta,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
	);
}

function driveFile(overrides: Partial<MiDriveFile> = {}): MiDriveFile {
	return {
		url: 'https://example.com/files/raw',
		webpublicUrl: 'https://example.com/files/public',
		uri: null,
		userHost: null,
		isLink: false,
		webpublicAccessKey: null,
		...overrides,
	} as MiDriveFile;
}

describe('DriveFileEntityService', () => {
	describe('getPublicUrl', () => {
		describe('allowProxiedUrl: false (default)', () => {
			const service = createService({
				externalMediaProxyEnabled: true,
				remoteProxy: 'https://remote-proxy.example.com',
			});

			test('returns webpublicUrl when present', () => {
				const file = driveFile();
				assert.strictEqual(
					service.getPublicUrl({ file }),
					'https://example.com/files/public',
				);
			});

			test('returns url when webpublicUrl is null', () => {
				const file = driveFile({ webpublicUrl: null });
				assert.strictEqual(
					service.getPublicUrl({ file }),
					'https://example.com/files/raw',
				);
			});

			test('does not proxy remote files even when proxies are enabled', () => {
				const file = driveFile({
					uri: 'https://remote.example/media/a.png',
					userHost: 'remote.example',
					webpublicAccessKey: 'accesskey1',
				});
				assert.strictEqual(
					service.getPublicUrl({ file }),
					'https://example.com/files/public',
				);
			});
		});

		describe('allowProxiedUrl: true, mode unset (regression: must not default to avatar)', () => {
			test('local file returns webpublicUrl without avatar mode', () => {
				const service = createService();
				const result = service.getPublicUrl({
					file: driveFile(),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://example.com/files/public');
				assert.ok(!result.includes('avatar'));
			});

			test('remote with externalMediaProxyEnabled uses image.webp without avatar=1', () => {
				const service = createService({
					externalMediaProxyEnabled: true,
				});
				const uri = 'https://remote.example/media/a.png';
				const result = service.getPublicUrl({
					file: driveFile({
						uri,
						userHost: 'remote.example',
						webpublicAccessKey: null,
					}),
					allowProxiedUrl: true,
				});
				assert.ok(result.startsWith('https://proxy.example.com/image.webp?'));
				assert.ok(result.includes(`url=${encodeURIComponent(uri)}`));
				assert.ok(!result.includes('avatar=1'));
				assert.ok(!result.includes('/avatar.webp'));
			});
		});

		describe("allowProxiedUrl: true, mode: 'avatar'", () => {
			test('local file is proxied as avatar.webp with avatar=1', () => {
				const service = createService();
				const result = service.getPublicUrl({
					file: driveFile(),
					mode: 'avatar',
					allowProxiedUrl: true,
				});
				assert.ok(result.startsWith('https://proxy.example.com/avatar.webp?'));
				assert.ok(result.includes('avatar=1'));
				assert.ok(result.includes(`url=${encodeURIComponent('https://example.com/files/public')}`));
			});

			test('remote with remoteProxy skips remoteProxy branch when mode is avatar', () => {
				const service = createService({
					remoteProxy: 'https://remote-proxy.example.com',
					externalMediaProxyEnabled: true,
				});
				const uri = 'https://remote.example/media/a.png';
				const result = service.getPublicUrl({
					file: driveFile({
						uri,
						userHost: 'remote.example',
						webpublicAccessKey: 'accesskey1',
					}),
					mode: 'avatar',
					allowProxiedUrl: true,
				});
				assert.ok(!result.startsWith('https://remote-proxy.example.com/'));
				assert.ok(result.startsWith('https://proxy.example.com/'));
				assert.ok(result.includes(`url=${encodeURIComponent(uri)}`));
			});
		});

		describe('allowProxiedUrl: true with remoteProxy (non-avatar mode)', () => {
			test('absolute remoteProxy returns remoteProxy/key', () => {
				const service = createService({
					remoteProxy: 'https://remote-proxy.example.com',
				});
				const result = service.getPublicUrl({
					file: driveFile({
						uri: 'https://remote.example/media/a.png',
						userHost: 'remote.example',
						webpublicAccessKey: 'accesskey1',
					}),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://remote-proxy.example.com/accesskey1');
			});

			test('relative remoteProxy is prefixed with config.url', () => {
				const service = createService({
					remoteProxy: '/remote-proxy',
				});
				const result = service.getPublicUrl({
					file: driveFile({
						uri: 'https://remote.example/media/a.png',
						userHost: 'remote.example',
						webpublicAccessKey: 'accesskey1',
					}),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://example.com/remote-proxy/accesskey1');
			});
		});

		describe('ap: true with apFileBaseUrl', () => {
			test('replaces origin when allowProxiedUrl is true and mode is unset', () => {
				const service = createService({
					apFileBaseUrl: 'https://ap-files.example.com',
				});
				const result = service.getPublicUrl({
					file: driveFile(),
					ap: true,
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://ap-files.example.com/files/public');
			});
		});
	});
});
