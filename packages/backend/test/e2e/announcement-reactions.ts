/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, beforeAll, test } from 'vitest';
import { api, failedApiCall, signup, sleep, uploadFile } from '../utils.js';
import type * as misskey from 'misskey-js';
let noRateLimitRoleId: string;

describe('Announcement reactions', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;
	let carol: misskey.entities.SignupResponse;
	let globalAnnouncement: { id: string };
	let personalAnnouncement: { id: string };

	async function createAnnouncement(params: {
		title: string;
		text?: string;
		userId?: string;
	}): Promise<{ id: string }> {
		const res = await api('admin/announcements/create', {
			title: params.title,
			text: params.text ?? 'x',
			imageUrl: null,
			...(params.userId != null ? { userId: params.userId } : {}),
		}, alice);
		assert.strictEqual(res.status, 200);
		return res.body as { id: string };
	}

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		carol = await signup({ username: 'carol' });

		const noRateLimitRoleRes = await api('admin/roles/create', {
			name: 'NoRateLimitForAnnouncementReactionsTest',
			description: 'announcement-reactions e2e で rate limit を無効化するためのテスト用ロール',
			color: null,
			iconUrl: null,
			displayOrder: 0,
			target: 'manual',
			condFormula: {},
			isAdministrator: false,
			isModerator: false,
			isPublic: false,
			isExplorable: false,
			asBadge: false,
			canEditMembersByModerator: false,
			policies: {
				rateLimitFactor: {
					useDefault: false,
					priority: 1,
					value: 0.3,
				},
			},
		}, alice);
		assert.strictEqual(noRateLimitRoleRes.status, 200);
		noRateLimitRoleId = (noRateLimitRoleRes.body as { id: string }).id;
		for (const user of [alice, bob, carol]) {
			assert.strictEqual((await api('admin/roles/assign', { userId: user.id, roleId: noRateLimitRoleId }, alice)).status, 204);
		}

		globalAnnouncement = await createAnnouncement({
			title: 'global',
			text: 'global announcement',
		});

		personalAnnouncement = await createAnnouncement({
			title: 'personal',
			text: 'personal announcement',
			userId: carol.id,
		});
	}, 1000 * 60 * 2);

	test('リアクションを作成すると announcements の reactions / myReactions が更新される', async () => {
		const createRes = await api('announcements/reactions/create', {
			announcementId: globalAnnouncement.id,
			reaction: 'like',
		}, bob);
		assert.strictEqual(createRes.status, 204);

		const listRes = await api('announcements', {}, bob);
		assert.strictEqual(listRes.status, 200);
		const item = (listRes.body as misskey.entities.Announcement[]).find(a => a.id === globalAnnouncement.id);
		assert.ok(item);
		assert.deepStrictEqual(item.reactions, { '👍': 1 });
		assert.deepStrictEqual(item.myReactions, ['👍']);
	});

	test('他人から見ると myReactions は空で reactions のカウントは変わらない', async () => {
		const listRes = await api('announcements', {}, carol);
		assert.strictEqual(listRes.status, 200);
		const item = (listRes.body as misskey.entities.Announcement[]).find(a => a.id === globalAnnouncement.id);
		assert.ok(item);
		assert.deepStrictEqual(item.reactions, { '👍': 1 });
		assert.deepStrictEqual(item.myReactions, []);
	});

	test('announcements/reactions でリアクション一覧を取得できる', async () => {
		const res = await api('announcements/reactions', {
			announcementId: globalAnnouncement.id,
		}, bob);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 1);
		assert.strictEqual(res.body[0].user.id, bob.id);
	});

	test('同じリアクションを二度付けると ALREADY_REACTED エラー', async () => {
		await failedApiCall({
			endpoint: 'announcements/reactions/create',
			parameters: { announcementId: globalAnnouncement.id, reaction: 'like' },
			user: bob,
		}, { status: 400, code: 'ALREADY_REACTED', id: '18aca5e1-b265-47b2-b40a-6cc0958fdeab' });
	});

	test('リアクションを削除できる', async () => {
		const deleteRes = await api('announcements/reactions/delete', {
			announcementId: globalAnnouncement.id,
			reaction: 'like',
		}, bob);
		assert.strictEqual(deleteRes.status, 204);

		const listRes = await api('announcements/reactions', {
			announcementId: globalAnnouncement.id,
		}, bob);
		assert.strictEqual(listRes.status, 200);
		assert.strictEqual(listRes.body.length, 0);

		const annRes = await api('announcements', {}, bob);
		assert.strictEqual(annRes.status, 200);
		const item = (annRes.body as misskey.entities.Announcement[]).find(a => a.id === globalAnnouncement.id);
		assert.ok(item);
		assert.deepStrictEqual(item.reactions, {});
		assert.deepStrictEqual(item.myReactions, []);
	});

	test('付けていないリアクションを削除すると NOT_REACTED エラー', async () => {
		await failedApiCall({
			endpoint: 'announcements/reactions/delete',
			parameters: { announcementId: globalAnnouncement.id, reaction: 'like' },
			user: carol,
		}, { status: 400, code: 'NOT_REACTED', id: '899123f8-6e9c-4ff1-b5f7-198657e9609a' });
	});

	test('存在しないお知らせには NO_SUCH_ANNOUNCEMENT エラー', async () => {
		await failedApiCall({
			endpoint: 'announcements/reactions/create',
			parameters: { announcementId: 'doesnotexist', reaction: 'like' },
			user: bob,
		}, { status: 400, code: 'NO_SUCH_ANNOUNCEMENT', id: '8cd3a0bb-4a35-47d7-9d4f-965bd3156879' });
	});

	test('個人宛てお知らせは他のユーザーから見えずリアクションもできない', async () => {
		const listRes = await api('announcements', {}, bob);
		assert.strictEqual(listRes.status, 200);
		assert.strictEqual(listRes.body.some((a: misskey.entities.Announcement) => a.id === personalAnnouncement.id), false);

		await failedApiCall({
			endpoint: 'announcements/reactions/create',
			parameters: { announcementId: personalAnnouncement.id, reaction: 'like' },
			user: bob,
		}, { status: 400, code: 'NO_SUCH_ANNOUNCEMENT', id: '8cd3a0bb-4a35-47d7-9d4f-965bd3156879' });

		await failedApiCall({
			endpoint: 'announcements/reactions',
			parameters: { announcementId: personalAnnouncement.id },
			user: bob,
		}, { status: 400, code: 'NO_SUCH_ANNOUNCEMENT', id: '28b39ced-db83-40f5-abba-af9111ee8f06' });
	});

	test('個人宛てお知らせは宛先ユーザーがリアクションできる', async () => {
		const res = await api('announcements/reactions/create', {
			announcementId: personalAnnouncement.id,
			reaction: 'like',
		}, carol);
		assert.strictEqual(res.status, 204);

		const listRes = await api('announcements', {}, carol);
		assert.strictEqual(listRes.status, 200);
		const item = (listRes.body as misskey.entities.Announcement[]).find(a => a.id === personalAnnouncement.id);
		assert.ok(item);
		assert.deepStrictEqual(item.reactions, { '👍': 1 });
		assert.deepStrictEqual(item.myReactions, ['👍']);
	});

	test('未認証ユーザーは作成・削除できない', async () => {
		await failedApiCall({
			endpoint: 'announcements/reactions/create',
			parameters: { announcementId: globalAnnouncement.id, reaction: 'like' },
			user: undefined,
		}, { status: 401, code: 'CREDENTIAL_REQUIRED', id: '1384574d-a912-4b81-8601-c7b1c4085df1' });

		await failedApiCall({
			endpoint: 'announcements/reactions/delete',
			parameters: { announcementId: globalAnnouncement.id, reaction: 'like' },
			user: undefined,
		}, { status: 401, code: 'CREDENTIAL_REQUIRED', id: '1384574d-a912-4b81-8601-c7b1c4085df1' });
	});

	test('複数ユーザー・複数種類のリアクションを集計できる', async () => {
		const ann = await createAnnouncement({ title: 'aggregate' });

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'like',
		}, bob)).status, 204);

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'pudding',
		}, bob)).status, 204);

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'like',
		}, carol)).status, 204);

		const bobView = await api('announcements', {}, bob);
		assert.strictEqual(bobView.status, 200);
		const itemBob = (bobView.body as misskey.entities.Announcement[]).find(a => a.id === ann.id);
		assert.ok(itemBob);
		assert.deepStrictEqual(itemBob.reactions, { '👍': 2, '🍮': 1 });
		assert.deepStrictEqual([...itemBob.myReactions].sort(), ['🍮', '👍']);

		const carolView = await api('announcements', {}, carol);
		assert.strictEqual(carolView.status, 200);
		const itemCarol = (carolView.body as misskey.entities.Announcement[]).find(a => a.id === ann.id);
		assert.ok(itemCarol);
		assert.deepStrictEqual(itemCarol.reactions, { '👍': 2, '🍮': 1 });
		assert.deepStrictEqual([...itemCarol.myReactions].sort(), ['👍']);
	});

	test('カスタム絵文字でリアクションでき type フィルタが機能する', async () => {
		const file = await uploadFile(alice, { path: '192.png' });
		assert.ok(file.body);
		const emojiRes = await api('admin/emoji/add', {
			name: 'announcement_test_emoji',
			fileId: file.body.id,
		}, alice);
		assert.strictEqual(emojiRes.status, 200);

		const ann = await createAnnouncement({ title: 'custom emoji' });

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: ':announcement_test_emoji@.:',
		}, bob)).status, 204);

		const filtered = await api('announcements/reactions', {
			announcementId: ann.id,
			type: ':announcement_test_emoji@.:',
		}, bob);
		assert.strictEqual(filtered.status, 200);
		assert.strictEqual(filtered.body.length, 1);
		assert.strictEqual(filtered.body[0].type, ':announcement_test_emoji@.:');

		const unmatched = await api('announcements/reactions', {
			announcementId: ann.id,
			type: '👍',
		}, bob);
		assert.strictEqual(unmatched.status, 200);
		assert.strictEqual(unmatched.body.length, 0);
	});

	test('非アクティブなお知らせにはリアクションできないが削除はできる', async () => {
		const ann = await createAnnouncement({ title: 'inactive' });

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'like',
		}, bob)).status, 204);

		const updateRes = await api('admin/announcements/update', {
			id: ann.id,
			title: 'inactive',
			text: 'x',
			imageUrl: null,
			isActive: false,
		}, alice);
		assert.strictEqual(updateRes.status, 204);

		await failedApiCall({
			endpoint: 'announcements/reactions/create',
			parameters: { announcementId: ann.id, reaction: 'pudding' },
			user: bob,
		}, { status: 400, code: 'NO_SUCH_ANNOUNCEMENT', id: '8cd3a0bb-4a35-47d7-9d4f-965bd3156879' });

		assert.strictEqual((await api('announcements/reactions/delete', {
			announcementId: ann.id,
			reaction: 'like',
		}, bob)).status, 204);
	});

	test('announcements/reactions のページネーションが機能する', async () => {
		const ann = await createAnnouncement({ title: 'pagination' });

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'like',
		}, bob)).status, 204);

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'pudding',
		}, carol)).status, 204);

		const firstPage = await api('announcements/reactions', {
			announcementId: ann.id,
			limit: 1,
		}, bob);
		assert.strictEqual(firstPage.status, 200);
		assert.strictEqual(firstPage.body.length, 1);

		const secondPage = await api('announcements/reactions', {
			announcementId: ann.id,
			limit: 1,
			untilId: firstPage.body[0].id,
		}, bob);
		assert.strictEqual(secondPage.status, 200);
		assert.strictEqual(secondPage.body.length, 1);
		assert.notStrictEqual(secondPage.body[0].id, firstPage.body[0].id);

		const emptyPage = await api('announcements/reactions', {
			announcementId: ann.id,
			limit: 1,
			untilId: secondPage.body[0].id,
		}, bob);
		assert.strictEqual(emptyPage.status, 200);
		assert.strictEqual(emptyPage.body.length, 0);
	});

	test('ロールポリシー reactionLimit でユーザーごとのリアクション数が制限される', async () => {
		const dave = await signup({ username: 'dave' });
		assert.strictEqual((await api('admin/roles/assign', { userId: dave.id, roleId: noRateLimitRoleId }, alice)).status, 204);
		const roleRes = await api('admin/roles/create', {
			name: 'reactionLimitTest',
			description: '',
			color: null,
			iconUrl: null,
			displayOrder: 0,
			target: 'manual',
			condFormula: {},
			isAdministrator: false,
			isModerator: false,
			isPublic: false,
			isExplorable: false,
			asBadge: false,
			canEditMembersByModerator: false,
			policies: {
				reactionLimit: {
					useDefault: false,
					priority: 1,
					value: 1,
				},
			},
		}, alice);
		assert.strictEqual(roleRes.status, 200);
		assert.strictEqual((await api('admin/roles/assign', {
			userId: dave.id,
			roleId: roleRes.body.id,
		}, alice)).status, 204);

		const ann = await createAnnouncement({ title: 'limit' });

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'like',
		}, dave)).status, 204);

		await failedApiCall({
			endpoint: 'announcements/reactions/create',
			parameters: { announcementId: ann.id, reaction: 'pudding' },
			user: dave,
		}, { status: 400, code: 'TOO_MANY_REACTIONS', id: 'd1a4b6c8-2e9f-4a3d-b7c5-6f0e8a9b2c1d' });

		// 削除すれば再度付けられる
		assert.strictEqual((await api('announcements/reactions/delete', {
			announcementId: ann.id,
			reaction: 'like',
		}, dave)).status, 204);

		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'pudding',
		}, dave)).status, 204);
	});

	test('ロールポリシー reactionLimit が 0 のユーザーはリアクションできない', async () => {
		const eve = await signup({ username: 'eve' });
		assert.strictEqual((await api('admin/roles/assign', { userId: eve.id, roleId: noRateLimitRoleId }, alice)).status, 204);
		const roleRes = await api('admin/roles/create', {
			name: 'reactionZeroTest',
			description: '',
			color: null,
			iconUrl: null,
			displayOrder: 0,
			target: 'manual',
			condFormula: {},
			isAdministrator: false,
			isModerator: false,
			isPublic: false,
			isExplorable: false,
			asBadge: false,
			canEditMembersByModerator: false,
			policies: {
				reactionLimit: {
					useDefault: false,
					priority: 1,
					value: 0,
				},
			},
		}, alice);
		assert.strictEqual(roleRes.status, 200);
		assert.strictEqual((await api('admin/roles/assign', {
			userId: eve.id,
			roleId: roleRes.body.id,
		}, alice)).status, 204);

		const ann = await createAnnouncement({ title: 'limit zero' });

		await failedApiCall({
			endpoint: 'announcements/reactions/create',
			parameters: { announcementId: ann.id, reaction: 'like' },
			user: eve,
		}, { status: 400, code: 'TOO_MANY_REACTIONS', id: 'd1a4b6c8-2e9f-4a3d-b7c5-6f0e8a9b2c1d' });
	});
});
