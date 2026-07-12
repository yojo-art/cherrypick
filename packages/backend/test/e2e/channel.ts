/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { api, randomString, signup } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('channels/create with canCreateChannel policy', () => {
	let root: misskey.entities.SignupResponse;
	let alice: misskey.entities.SignupResponse;
	let roleId: string;
	const defaultCanCreateChannel = true;

	beforeAll(async () => {
		root = await signup({ username: 'root' });
		alice = await signup({ username: 'alice' });

		const res = await api('admin/roles/create', {
			name: 'New Role',
			description: '',
			color: null,
			iconUrl: null,
			target: 'manual',
			condFormula: { },
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
