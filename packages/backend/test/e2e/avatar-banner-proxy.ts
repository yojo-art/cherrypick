/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { api, initTestDb, randomString, signup, simpleGet, successfulApiCall, uploadFile } from '../utils.js';
import type * as misskey from 'misskey-js';
import type { DataSource, Repository } from 'typeorm';
import { loadConfig } from '@/config.js';
import { MiUser } from '@/models/User.js';
import { MiDriveFile } from '@/models/DriveFile.js';

// DBには元のURLを保存し、APIで返すときにメディアプロキシのURLを付与することを確認する
describe('アバター/バナーURLのメディアプロキシ', () => {
	const config = loadConfig();

	let connection: DataSource;
	let usersRepository: Repository<MiUser>;
	let driveFilesRepository: Repository<MiDriveFile>;

	let root: misskey.entities.SignupResponse;
	let alice: misskey.entities.SignupResponse;

	async function rawUrlOf(fileId: string): Promise<string> {
		const file = await driveFilesRepository.findOneByOrFail({ id: fileId });
		return file.webpublicUrl ?? file.url;
	}

	function assertAvatarProxyUrl(actual: string | null | undefined, originalUrl: string): void {
		assert.ok(actual, 'URLが返される');
		const url = new URL(actual);
		assert.strictEqual(`${url.origin}${url.pathname}`, `${config.mediaProxy}/avatar.webp`);
		assert.strictEqual(url.searchParams.get('url'), originalUrl);
		assert.strictEqual(url.searchParams.get('avatar'), '1');
	}

	function assertBannerProxyUrl(actual: string | null | undefined, originalUrl: string): void {
		assert.ok(actual, 'URLが返される');
		const url = new URL(actual);
		assert.strictEqual(`${url.origin}${url.pathname}`, `${config.mediaProxy}/image.webp`);
		assert.strictEqual(url.searchParams.get('url'), originalUrl);
	}

	beforeAll(async () => {
		connection = await initTestDb(true);
		usersRepository = connection.getRepository(MiUser);
		driveFilesRepository = connection.getRepository(MiDriveFile);

		root = await signup({ username: 'root' });
		alice = await signup({ username: 'alice' });
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await connection.destroy();
	});

	describe('i/update', () => {
		test('アバターはDBに元のURLで保存され、APIではアバター用プロキシURLで返る', async () => {
			const file = (await uploadFile(alice)).body!;
			const response = await successfulApiCall({ endpoint: 'i/update', parameters: { avatarId: file.id }, user: alice });
			const rawUrl = await rawUrlOf(file.id);

			const stored = await usersRepository.findOneByOrFail({ id: alice.id });
			assert.strictEqual(stored.avatarUrl, rawUrl);
			assertAvatarProxyUrl(response.avatarUrl, rawUrl);

			const shown = await successfulApiCall({ endpoint: 'users/show', parameters: { userId: alice.id }, user: root });
			assert.strictEqual(shown.avatarUrl, response.avatarUrl);
		});

		test('/avatar/@username は users/show と同じアバターURLへリダイレクトする', async () => {
			const shown = await successfulApiCall({ endpoint: 'users/show', parameters: { userId: alice.id }, user: root });
			const res = await simpleGet(`/avatar/@${alice.username}`);

			assert.strictEqual(res.status, 302);
			assert.strictEqual(res.location, shown.avatarUrl);
		});

		test('ローカルユーザーのバナーはDBに元のURLで保存され、APIではプロキシURLで返る', async () => {
			const file = (await uploadFile(alice)).body!;
			const response = await successfulApiCall({ endpoint: 'i/update', parameters: { bannerId: file.id }, user: alice });
			const rawUrl = await rawUrlOf(file.id);

			const stored = await usersRepository.findOneByOrFail({ id: alice.id });
			assert.strictEqual(stored.bannerUrl, rawUrl);
			assertBannerProxyUrl(response.bannerUrl, rawUrl);
		});
	});

	describe('channels', () => {
		async function assertChannelIcon(channel: misskey.entities.Channel): Promise<void> {
			assert.ok(channel.actorId, 'チャンネルアカウントが作成される');

			// アイコンはチャンネルアカウント用にコピーされるため、アカウントのavatarIdのファイルと比較する
			const actor = await usersRepository.findOneByOrFail({ id: channel.actorId });
			assert.ok(actor.avatarId, 'チャンネルアカウントのavatarIdが設定される');
			const rawUrl = await rawUrlOf(actor.avatarId);
			assert.strictEqual(actor.avatarUrl, rawUrl, 'チャンネルアカウントのavatarUrlは元のURLで保存される');
			assertAvatarProxyUrl(channel.iconUrl, rawUrl);

			const shown = await successfulApiCall({ endpoint: 'users/show', parameters: { userId: channel.actorId }, user: root });
			assert.strictEqual(shown.avatarUrl, channel.iconUrl, 'チャンネルのiconUrlとアカウントのavatarUrlが一致する');
		}

		test('channels/create でアイコンを設定するとDBに元のURL、APIにプロキシURLが入る', async () => {
			const icon = (await uploadFile(root)).body!;
			const res = await api('channels/create', { name: randomString(), username: randomString(), iconId: icon.id }, root);
			assert.strictEqual(res.status, 200);

			await assertChannelIcon(res.body);
		});

		test('channels/update でアイコンを差し替えてもDBに元のURL、APIにプロキシURLが入る', async () => {
			const created = await api('channels/create', { name: randomString(), username: randomString() }, root);
			assert.strictEqual(created.status, 200);

			const icon = (await uploadFile(root)).body!;
			// NOTE: iconIdだけを渡すとチャンネル側の更新値が空になりUpdateValuesMissingErrorになる既存の不具合があるため、nameも渡す
			const updated = await api('channels/update', { channelId: created.body.id, name: randomString(), iconId: icon.id }, root);
			assert.strictEqual(updated.status, 200);

			await assertChannelIcon(updated.body);
		});

		test('channels/create でバナーを設定するとDBに元のURL、APIにプロキシURLが入る', async () => {
			const banner = (await uploadFile(root)).body!;
			const res = await api('channels/create', { name: randomString(), username: randomString(), bannerId: banner.id }, root);
			assert.strictEqual(res.status, 200);
			assert.ok(res.body.actorId, 'チャンネルアカウントが作成される');

			// バナーはチャンネルアカウント用にコピーされるため、チャンネルのbannerIdのファイルと比較する
			assert.ok(res.body.bannerId, 'チャンネルのbannerIdが設定される');
			const rawUrl = await rawUrlOf(res.body.bannerId);
			assertBannerProxyUrl(res.body.bannerUrl, rawUrl);

			const actor = await usersRepository.findOneByOrFail({ id: res.body.actorId });
			assert.strictEqual(actor.bannerUrl, rawUrl, 'チャンネルアカウントのbannerUrlは元のURLで保存される');

			const shown = await successfulApiCall({ endpoint: 'users/show', parameters: { userId: res.body.actorId }, user: root });
			assert.strictEqual(shown.bannerUrl, res.body.bannerUrl, 'チャンネルのbannerUrlとアカウントのbannerUrlが一致する');
		});
	});
});
