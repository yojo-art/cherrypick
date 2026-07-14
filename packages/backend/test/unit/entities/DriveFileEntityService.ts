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
		describe('allowProxiedUrl: false（デフォルト）', () => {
			const service = createService({
				externalMediaProxyEnabled: true,
				remoteProxy: 'https://remote-proxy.example.com',
			});

			test('webpublicUrlがある場合はそれを返す', () => {
				const file = driveFile();
				assert.strictEqual(
					service.getPublicUrl({ file }),
					'https://example.com/files/public',
				);
			});

			test('webpublicUrlがnullの場合はurlを返す', () => {
				const file = driveFile({ webpublicUrl: null });
				assert.strictEqual(
					service.getPublicUrl({ file }),
					'https://example.com/files/raw',
				);
			});

			test('プロキシが有効でもリモートファイルはプロキシしない', () => {
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

		describe('allowProxiedUrl: true、mode未指定（リグレッション: avatarにデフォルトしない）', () => {
			test('ローカルファイルはavatarモードなしでwebpublicUrlを返す', () => {
				const service = createService();
				const result = service.getPublicUrl({
					file: driveFile(),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://example.com/files/public');
				assert.ok(!result.includes('avatar'));
			});

			test('remoteでexternalMediaProxyEnabled時はavatar=1なしのimage.webpを使う', () => {
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

		describe("allowProxiedUrl: true、mode: 'avatar'", () => {
			test('ローカルファイルはavatar=1付きのavatar.webpでプロキシされる', () => {
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

			test('remoteでremoteProxyがあってもmodeがavatarならremoteProxy分岐をスキップする', () => {
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

		describe('allowProxiedUrl: trueでremoteProxyあり（avatar以外）', () => {
			test('絶対URLのremoteProxyはremoteProxy/keyを返す', () => {
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

			test('相対パスのremoteProxyはconfig.urlを前置する', () => {
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

		describe('ap: trueでapFileBaseUrlあり', () => {
			test('allowProxiedUrlがtrueかつmode未指定ならオリジンを置換する', () => {
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
