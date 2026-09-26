/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, test } from 'vitest';
import type { Config } from '@/config.js';
import type { MiChannel, MiDriveFile, MiMeta } from '@/models/_.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { IdService } from '@/core/IdService.js';
import { genAidx } from '@/misc/id/aidx.js';

function createService(
	configOverrides: Partial<Config> = {},
	metaOverrides: Partial<MiMeta> = {},
): ChannelEntityService {
	const config = {
		id: 'aidx',
		url: 'https://example.com',
		mediaProxy: 'https://proxy.example.com',
		externalMediaProxyEnabled: false,
		...configOverrides,
	} as Config;
	const driveFileEntityService = new DriveFileEntityService(
		config,
		{
			proxyRemoteFiles: true,
			...metaOverrides,
		} as MiMeta,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
	);
	return new ChannelEntityService(
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		driveFileEntityService,
		new IdService(config),
		{} as any,
	);
}

function channel(overrides: Partial<MiChannel> = {}): MiChannel {
	return {
		id: genAidx(Date.now()),
		lastNotedAt: null,
		userId: null,
		name: 'channel',
		description: null,
		bannerId: 'banner',
		pinnedNoteIds: [],
		color: '#000000',
		isArchived: false,
		usersCount: 0,
		notesCount: 0,
		isSensitive: false,
		allowRenoteToExternal: true,
		host: null,
		actorId: null,
		...overrides,
	} as MiChannel;
}

function bannerFile(overrides: Partial<MiDriveFile> = {}): MiDriveFile {
	return {
		id: 'banner',
		url: 'https://example.com/files/raw',
		webpublicUrl: null,
		uri: null,
		userHost: null,
		isLink: false,
		storedInternal: true,
		webpublicAccessKey: null,
		...overrides,
	} as MiDriveFile;
}

async function packBannerUrl(service: ChannelEntityService, src: MiChannel, file: MiDriveFile): Promise<string | null> {
	const packed = await service.pack(src, null, false, { bannerFiles: new Map([[file.id, file]]) });
	return packed.bannerUrl;
}

function assertProxied(actual: string | null, rawUrl: string): void {
	assert.ok(actual, 'URLが返される');
	const result = new URL(actual);
	assert.strictEqual(`${result.origin}${result.pathname}`, 'https://proxy.example.com/image.webp');
	assert.strictEqual(result.searchParams.get('url'), rawUrl);
}

describe('ChannelEntityService', () => {
	describe('bannerUrlのメディアプロキシ付与', () => {
		const remoteUrl = 'https://remote.example/media/banner.png';
		const remoteFile = bannerFile({ url: remoteUrl, uri: remoteUrl, userHost: 'remote.example', isLink: true, storedInternal: false });
		const remoteChannel = channel({ host: 'remote.example' });

		test.each([true, false])('ローカルのチャンネルのバナーはproxyRemoteFiles=%sでもプロキシする', async (proxyRemoteFiles) => {
			const service = createService({}, { proxyRemoteFiles });
			assertProxied(await packBannerUrl(service, channel(), bannerFile()), 'https://example.com/files/raw');
		});

		test('ローカルのチャンネルのバナーはwebpublicUrlがあればそれをプロキシする', async () => {
			const service = createService();
			const file = bannerFile({ webpublicUrl: 'https://example.com/files/public' });
			assertProxied(await packBannerUrl(service, channel(), file), 'https://example.com/files/public');
		});

		test('リモートのチャンネルのバナーはproxyRemoteFiles=trueならプロキシする', async () => {
			const service = createService({}, { proxyRemoteFiles: true });
			assertProxied(await packBannerUrl(service, remoteChannel, remoteFile), remoteUrl);
		});

		test('リモートのチャンネルのバナーはproxyRemoteFiles=falseなら元のURLを返す', async () => {
			const service = createService({}, { proxyRemoteFiles: false });
			assert.strictEqual(await packBannerUrl(service, remoteChannel, remoteFile), remoteUrl);
		});

		test('リモートのチャンネルのバナーは外部メディアプロキシが有効ならproxyRemoteFiles=falseでもプロキシする', async () => {
			const service = createService({ externalMediaProxyEnabled: true }, { proxyRemoteFiles: false });
			assertProxied(await packBannerUrl(service, remoteChannel, remoteFile), remoteUrl);
		});

		test('バナー未設定ならnullを返す', async () => {
			const service = createService();
			const packed = await service.pack(channel({ bannerId: null }), null);
			assert.strictEqual(packed.bannerUrl, null);
		});
	});
});
