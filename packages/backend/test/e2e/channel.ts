/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { api, castAsError, signup, randomString, uploadUrl, post } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('Channel', () => {
	let root: misskey.entities.SignupResponse;
	let alice: misskey.entities.SignupResponse;

	beforeAll(async () => {
		root = await signup({ username: 'root' });
		alice = await signup({ username: 'alice' });
	});

	describe('Create with canCreateChannel policy', () => {
		let roleId: string;
		const defaultCanCreateChannel = true;

		beforeAll(async () => {
			const res = await api('admin/roles/create', {
				name: 'New Role',
				description: '',
				color: null,
				iconUrl: null,
				target: 'manual',
				condFormula: {},
				displayOrder: 0,
				canEditMembersByModerator: false,
				asBadge: false,
				isAdministrator: false,
				isExplorable: false,
				isModerator: false,
				isPublic: false,
				policies: {
					canCreateChannel: false,
				} as any,
			}, root);
			assert.strictEqual(res.status, 200, 'ロールが作成されること');
			assert.strictEqual(res.body.name, 'New Role', 'ロール名が New Role に設定されること');
			assert.strictEqual(res.body.policies.canCreateChannel, false, 'チャンネル作成ポリシーが false であること');
			roleId = res.body.id;
		});

		afterAll(async () => {
			await api('admin/roles/delete', { roleId }, root).catch(() => {});
		});

		beforeEach(async () => {
			await api('admin/roles/update-default-policies', {
				policies: {
					canCreateChannel: defaultCanCreateChannel,
				} as any,
			}, root);
		});

		test('ベースロールで canCreateChannel が false ならチャンネルを作成できない', async () => {
			await api('admin/roles/update-default-policies', {
				policies: {
					canCreateChannel: false,
				} as any,
			}, root);

			// /api/i を叩いて policies.canCreateChannel が false であることを確認
			const iRes = await api('i', {}, alice);
			assert.strictEqual(iRes.status, 200);
			assert.strictEqual(iRes.body.policies.canCreateChannel, false);

			const res = await api('channels/create', { name: 'channel-ng', username: randomString() }, alice);
			assert.strictEqual(res.status, 403, 'チャンネル作成が拒否されること');
		});

		test('ベースロールで canCreateChannel が true ならチャンネルを作成できる', async () => {
			const iRes = await api('i', {}, alice);
			assert.strictEqual(iRes.status, 200);
			assert.strictEqual(iRes.body.policies.canCreateChannel, true, 'canCreateChannel が true であること');

			const res = await api('channels/create', { name: 'channel-ok', username: randomString() }, alice);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.name, 'channel-ok', 'チャンネル作成ができること');
		});

		test('付与したロールで canCreateChannel が false ならチャンネルを作成できない', async() => {
			const iRes1 = await api('i', {}, alice);
			assert.strictEqual(iRes1.status, 200);
			assert.strictEqual(iRes1.body.policies.canCreateChannel, true, 'canCreateChannel が true であること');

			const res = await api('admin/roles/assign', { expiresAt: null, roleId: roleId, userId: alice.id }, root);
			assert.strictEqual(res.status, 204);

			// ロール割り当て後、チャンネルが作成できないポリシーになっていることを確認する
			const iRes2 = await api('i', {}, alice);
			assert.strictEqual(iRes2.status, 200);
			assert.strictEqual(iRes2.body.policies.canCreateChannel, false, 'canCreateChannel が false であること');

			const res2 = await api('channels/create', { name: 'channel-ng', username: randomString() }, alice);
			assert.strictEqual(res2.status, 403, 'チャンネル作成が拒否されること');
		});
	});

	describe('Follow', () => {
		let channel: misskey.entities.ChannelsCreateResponse;

		beforeAll(async () => {
			const res = await api('channels/create', { name: 'follow-test-channel', username: randomString() }, root);
			channel = res.body;
		});

		test('フォローしているチャンネルを再度フォローするとALREADY_FOLLOWINGエラーになる', async () => {
			const res1 = await api('channels/follow', { channelId: channel.id }, alice);
			assert.strictEqual(res1.status, 204);

			const res2 = await api('channels/follow', { channelId: channel.id }, alice);
			assert.strictEqual(res2.status, 400);
			assert.strictEqual(castAsError(res2.body as any).error.code, 'ALREADY_FOLLOWING');
		});
	});

	describe('チャンネル作成時の基本設定', () => {
		test('チャンネル作成時にバナーが設定される', async () => {
			const file = await uploadUrl(root, 'https://raw.githubusercontent.com/yojo-art/cherrypick/develop/packages/backend/test/resources/192.jpg');
			const username = randomString();
			const name = randomString() + ' Channel';
			const ch = await api('channels/create', { username: username, name: name, bannerId: file.id }, root);
			assert.strictEqual(ch.status, 200);
			assert.notStrictEqual(ch.body.bannerUrl, null, 'チャンネルのbannerUrlが設定される');
			const channelActor = await api('users/show', { userId: ch.body.actorId! }, root);
			assert.notStrictEqual(channelActor.body.bannerUrl, null, 'チャンネルアカウントのbannerUrlが設定される');
			assert.notStrictEqual(channelActor.body.bannerBlurhash, null, 'チャンネルアカウントのbannerBlurhashが設定される');
		});

		test('チャンネル作成時にユーザーの名前が設定される', async () => {
			const username = randomString();
			const name = randomString() + ' Channel';
			const ch = await api('channels/create', { username: username, name: name }, root);
			assert.strictEqual(ch.status, 200);
			const channelActor = await api('users/show', { userId: ch.body.actorId! }, root);
			assert.strictEqual(channelActor.body.name!, name, 'チャンネル作成時に指定した名前がユーザーとして正しく設定される');
		});
	});

	describe('usersCount', () => {
		test('チャンネルへの投稿でチャンネルアカウントのリノートがusersCountに含まれない', async () => {
			const ch = await api('channels/create', { name: 'usersCount-test', username: randomString() }, root);
			assert.strictEqual(ch.status, 200);
			const channelId = ch.body.id;

			// 投稿前は0
			const beforeRes = await api('channels/show', { channelId }, root);
			assert.strictEqual(beforeRes.status, 200);
			assert.strictEqual(beforeRes.body.usersCount, 0, '投稿前のusersCountは0');

			// Aliceがチャンネルに投稿
			await post(alice, { text: 'hello channel', channelId });

			// 自動リノートとusersCountインクリメントが完了するまで待つ
			await new Promise(resolve => setTimeout(resolve, 3000));

			const afterRes = await api('channels/show', { channelId }, root);
			assert.strictEqual(afterRes.status, 200);
			assert.strictEqual(afterRes.body.usersCount, 1, 'チャンネルアカウントのリノートを除きusersCountは1のはず');
		});
	});

	describe('notesCount', () => {
		test('チャンネルへの投稿でチャンネルアカウントのリノートがnotesCountに含まれない', async () => {
			const ch = await api('channels/create', { name: 'notesCount-test', username: randomString() }, root);
			assert.strictEqual(ch.status, 200);
			const channelId = ch.body.id;

			// 投稿前は0
			const beforeRes = await api('channels/show', { channelId }, root);
			assert.strictEqual(beforeRes.status, 200);
			assert.strictEqual(beforeRes.body.notesCount, 0, '投稿前のnotesCountは0');

			// Aliceがチャンネルに投稿
			await post(alice, { text: 'hello channel notes', channelId });

			// 自動リノートが完了するまで待つ
			await new Promise(resolve => setTimeout(resolve, 1000));

			const afterRes = await api('channels/show', { channelId }, root);
			assert.strictEqual(afterRes.status, 200);
			assert.strictEqual(afterRes.body.notesCount, 1, 'チャンネルアカウントのリノートを除きnotesCountは1');
		});
	});
});
