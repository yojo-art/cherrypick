/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, beforeAll, test } from 'vitest';
import { api, failedApiCall, signup, sleep, uploadFile } from '../utils.js';
import type * as misskey from 'misskey-js';

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
		reactionAcceptance?: 'likeOnly' | 'nonSensitiveOnly' | 'none' | null;
	}): Promise<{ id: string }> {
		const res = await api('admin/announcements/create', {
			title: params.title,
			text: params.text ?? 'x',
			imageUrl: null,
			reactionAcceptance: params.reactionAcceptance ?? null,
			...(params.userId != null ? { userId: params.userId } : {}),
		}, alice);
		assert.strictEqual(res.status, 200);
		return res.body as { id: string };
	}

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		carol = await signup({ username: 'carol' });

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

		await sleep(3100);
		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'like',
		}, bob)).status, 204);

		await sleep(3100);
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

		await sleep(3100);
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

		await sleep(3100);
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

		await sleep(3100);
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

		await sleep(3100);
		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: 'like',
		}, bob)).status, 204);

		await sleep(3100);
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

	test('likeOnly のお知らせでは任意のリアクションが ❤ に強制される', async () => {
		const ann = await createAnnouncement({ title: 'likeOnly', reactionAcceptance: 'likeOnly' });

		await sleep(3100);
		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: '👍',
		}, bob)).status, 204);

		const listRes = await api('announcements', {}, bob);
		assert.strictEqual(listRes.status, 200);
		const item = (listRes.body as misskey.entities.Announcement[]).find(a => a.id === ann.id);
		assert.ok(item);
		assert.deepStrictEqual(item.reactions, { '❤': 1 });
		assert.deepStrictEqual(item.myReactions, ['❤']);
	});

	test('nonSensitiveOnly のお知らせではセンシティブなカスタム絵文字は ❤ に強制される', async () => {
		const file = await uploadFile(alice, { path: '192.png' });
		assert.ok(file.body);
		const secretRes = await api('admin/emoji/add', {
			name: 'announcement_test_secret',
			fileId: file.body.id,
			isSensitive: true,
		}, alice);
		assert.strictEqual(secretRes.status, 200);

		const file2 = await uploadFile(alice, { path: '192.png' });
		assert.ok(file2.body);
		const okRes = await api('admin/emoji/add', {
			name: 'announcement_test_ok',
			fileId: file2.body.id,
			isSensitive: false,
		}, alice);
		assert.strictEqual(okRes.status, 200);

		const ann = await createAnnouncement({ title: 'nonSensitiveOnly', reactionAcceptance: 'nonSensitiveOnly' });

		await sleep(3100);
		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann.id,
			reaction: ':announcement_test_secret@.:',
		}, bob)).status, 204);

		let listRes = await api('announcements', {}, bob);
		let item = (listRes.body as misskey.entities.Announcement[]).find(a => a.id === ann.id);
		assert.ok(item);
		assert.deepStrictEqual(item.reactions, { '❤': 1 });

		// 非センシティブはそのまま
		const ann2 = await createAnnouncement({ title: 'nonSensitiveOnly2', reactionAcceptance: 'nonSensitiveOnly' });
		await sleep(3100);
		assert.strictEqual((await api('announcements/reactions/create', {
			announcementId: ann2.id,
			reaction: ':announcement_test_ok@.:',
		}, bob)).status, 204);
		listRes = await api('announcements', {}, bob);
		item = (listRes.body as misskey.entities.Announcement[]).find(a => a.id === ann2.id);
		assert.ok(item);
		assert.deepStrictEqual(item.reactions, { ':announcement_test_ok@.:': 1 });
	});

	test('none のお知らせではリアクションが拒否される', async () => {
		const ann = await createAnnouncement({ title: 'none', reactionAcceptance: 'none' });

		await sleep(3100);
		await failedApiCall({
			endpoint: 'announcements/reactions/create',
			parameters: { announcementId: ann.id, reaction: 'like' },
			user: bob,
		}, { status: 400, code: 'REACTIONS_NOT_ALLOWED', id: '5dc6d2af-e34c-4cdf-9303-1875fa390d02' });

		const listRes = await api('announcements', {}, bob);
		assert.strictEqual(listRes.status, 200);
		const item = (listRes.body as misskey.entities.Announcement[]).find(a => a.id === ann.id);
		assert.ok(item);
		assert.deepStrictEqual(item.reactions, {});
		assert.deepStrictEqual(item.myReactions, []);
	});
});
