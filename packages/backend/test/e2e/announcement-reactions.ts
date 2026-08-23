/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, beforeAll, test } from 'vitest';
import { api, failedApiCall, signup, sleep } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('Announcement reactions', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;
	let carol: misskey.entities.SignupResponse;
	let globalAnnouncement: { id: string };
	let personalAnnouncement: { id: string };

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		carol = await signup({ username: 'carol' });

		const globalRes = await api('admin/announcements/create', {
			title: 'global',
			text: 'global announcement',
			imageUrl: null,
		}, alice);
		assert.strictEqual(globalRes.status, 200);
		globalAnnouncement = globalRes.body as { id: string };

		const personalRes = await api('admin/announcements/create', {
			title: 'personal',
			text: 'personal announcement',
			imageUrl: null,
			userId: carol.id,
		}, alice);
		assert.strictEqual(personalRes.status, 200);
		personalAnnouncement = personalRes.body as { id: string };
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
		await sleep(3100);
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
		assert.strictEqual(listRes.body.length, 0);

		const annRes = await api('announcements', {}, bob);
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
});
