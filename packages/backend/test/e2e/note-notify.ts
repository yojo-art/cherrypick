/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';
import { describe, beforeAll, test } from '@jest/globals';
import { api, signup, uploadUrl } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('users/notify/list', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;
	let carol: misskey.entities.SignupResponse;
	let dave: misskey.entities.SignupResponse;

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		carol = await signup({ username: 'carol' });
		dave = await signup({ username: 'dave' });
	}, 1000 * 60 * 2);

	test('通知設定なしのフォローのみの場合、空配列が返る', async () => {
		// alice が bob を普通にフォロー（通知設定なし）
		await api('following/create', { userId: bob.id }, alice);

		const res = await api('users/notify/list', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 0);
	});

	test('通知設定ありのフォローがある場合、そのユーザーが返る', async () => {
		// alice が carol をフォローして通知ON
		await api('following/create', { userId: carol.id }, alice);
		await api('following/update', { userId: carol.id, notify: 'normal' }, alice);

		const res = await api('users/notify/list', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 1);
		assert.strictEqual(res.body[0].user.id, carol.id);
	});

	test('複数ユーザーで通知設定ありの場合、全員返る', async () => {
		// bob にも通知設定をON
		await api('following/update', { userId: bob.id, notify: 'normal' }, alice);

		const res = await api('users/notify/list', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 2);

		const ids = res.body.map((u: { id: string, user: misskey.entities.UserDetailed }) => u.user.id).sort();
		assert.deepStrictEqual(ids, [bob.id, carol.id].sort());
	});

	test('withFile 設定のユーザーも一覧に含まれる', async () => {
		// alice が dave をフォローして withFile 通知ON
		await api('following/create', { userId: dave.id }, alice);
		await api('following/update', { userId: dave.id, notify: 'withFile' }, alice);

		const res = await api('users/notify/list', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 3);

		const ids = res.body.map((u: { id: string, user: misskey.entities.UserDetailed }) => u.user.id).sort();
		assert.deepStrictEqual(ids, [bob.id, carol.id, dave.id].sort());
	});

	test('normal と withFile が混在していても全員返る', async () => {
		// bob: normal, carol: normal, dave: withFile の状態
		const res = await api('users/notify/list', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 3);

		const ids = res.body.map(r => r.user.id);
		assert.strictEqual(ids.includes(bob.id), true);
		assert.strictEqual(ids.includes(carol.id), true);
		assert.strictEqual(ids.includes(dave.id), true);
	});

	test('withFile から none に変更すると一覧から外れる', async () => {
		await api('following/update', { userId: dave.id, notify: 'none' }, alice);

		const res = await api('users/notify/list', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 2);

		const ids = res.body.map((u: { id: string, user: misskey.entities.UserDetailed }) => u.user.id);
		assert.strictEqual(ids.includes(dave.id), false);
	});

	test('通知設定をOFF（none）にすると一覧から外れる', async () => {
		await api('following/update', { userId: bob.id, notify: 'none' }, alice);

		const res = await api('users/notify/list', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 1);
		assert.strictEqual(res.body[0].user.id, carol.id);
	});

	test('他のユーザーの通知対象は見えない', async () => {
		// bob が carol をフォローして通知ON
		await api('following/create', { userId: carol.id }, bob);
		await api('following/update', { userId: carol.id, notify: 'normal' }, bob);

		// alice の一覧には bob の通知設定は反映されない
		const aliceRes = await api('users/notify/list', {}, alice);
		const aliceIds = aliceRes.body.map((u: { id: string, user: misskey.entities.UserDetailed }) => u.user.id);
		assert.strictEqual(aliceIds.includes(bob.id), false);

		// bob の一覧には carol だけが含まれる
		const bobRes = await api('users/notify/list', {}, bob);
		assert.strictEqual(bobRes.body.length, 1);
		assert.strictEqual(bobRes.body[0].user.id, carol.id);

		// 後片付け: bob → carol のフォローを解除
		await api('following/delete', { userId: carol.id }, bob);
	});

	test('normal通知設定時、投稿で通知が届く', async () => {
		await api('following/update', { userId: bob.id, notify: 'normal' }, alice);

		await api('notifications/mark-all-as-read', {}, alice);
		const textOnlyRes = await api('notes/create', {
			text: 'ファイルなしの投稿',
		}, bob);
		assert.strictEqual(textOnlyRes.status, 200);
		// redisに追加されるのを待つ
		await setTimeout(100);

		const beforeRes = await api('i/notifications', {}, alice);
		assert.strictEqual(beforeRes.status, 200);
		const noteNotif = beforeRes.body.filter((n: { type: string; note?: { id: string } }) =>
			n.type === 'note' && n.note?.id === textOnlyRes.body.createdNote.id,
		);

		assert.strictEqual(noteNotif.length, 1, '投稿の通知が届かなかった');

		// 後片付け
		await api('following/update', { userId: bob.id, notify: 'none' }, alice);
		await api('notifications/mark-all-as-read', {}, alice);
	});

	test('withFile通知設定時、ファイル付き投稿で通知が届く', async () => {
		await api('following/update', { userId: bob.id, notify: 'withFile' }, alice);

		// 既存の通知をクリア
		await api('notifications/mark-all-as-read', {}, alice);

		// --- ケース1: テキストのみの投稿 → 通知が来ないこと ---
		const textOnlyRes = await api('notes/create', {
			text: 'ファイルなしの投稿',
		}, bob);
		assert.strictEqual(textOnlyRes.status, 200);

		// redisに追加されるのを待つ
		await setTimeout(100);

		const beforeRes = await api('i/notifications', {}, alice);
		assert.strictEqual(beforeRes.status, 200);
		const noteNotifsBefore = beforeRes.body.filter((n: { type: string; note?: { id: string } }) =>
			n.type === 'note' && n.note?.id === textOnlyRes.body.createdNote.id,
		);
		assert.strictEqual(noteNotifsBefore.length, 0, 'ファイルなし投稿で通知が来てしまった');

		// --- ケース2: ファイル付き投稿 → 通知が来ること ---
		const file = await uploadUrl(bob, 'https://raw.githubusercontent.com/misskey-dev/misskey/develop/packages/backend/test/resources/192.jpg');

		const fileNoteRes = await api('notes/create', {
			fileIds: [file.id],
		}, bob);
		assert.strictEqual(fileNoteRes.status, 200);
		assert.deepStrictEqual(fileNoteRes.body.createdNote.fileIds, [file.id]);

		// redisに追加されるのを待つ
		await setTimeout(100);

		const res = await api('i/notifications', {}, alice);
		assert.strictEqual(res.status, 200);

		const noteNotif = res.body.filter((n: { type: string; note?: { id: string } }) =>
			n.type === 'note' && n.note?.id === fileNoteRes.body.createdNote.id,
		);

		assert.strictEqual(noteNotif.length, 1, 'ファイル付き投稿の通知が届かなかった');

		// 後片付け
		await api('following/update', { userId: bob.id, notify: 'none' }, alice);
		await api('notifications/mark-all-as-read', {}, alice);
	});

	test('limit パラメータが効く', async () => {
		// limit テスト用に bob を再度ONにして2件状態を作る
		await api('following/update', { userId: bob.id, notify: 'normal' }, alice);

		// limitなしだと2件返ることを確認
		const allRes = await api('users/notify/list', {}, alice);
		assert.strictEqual(allRes.status, 200);
		assert.strictEqual(allRes.body.length, 2);

		// limit:1 で1件に絞られることを確認
		const res = await api('users/notify/list', { limit: 1 }, alice);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 1);
	});

	test('untilId パラメータが効く', async () => {
		const allRes = await api('users/notify/list', {}, alice);
		assert.strictEqual(allRes.status, 200);
		assert.strictEqual(allRes.body.length, 2);

		const newerId = allRes.body[0].id;
		const olderId = allRes.body[1].id;

		const res = await api('users/notify/list', { untilId: newerId }, alice);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 1);
		assert.strictEqual(res.body[0].id, olderId);
	});

	test('sinceId パラメータが効く', async () => {
		const allRes = await api('users/notify/list', {}, alice);
		assert.strictEqual(allRes.status, 200);
		assert.strictEqual(allRes.body.length, 2);

		const newerId = allRes.body[0].id;
		const olderId = allRes.body[1].id;

		const res = await api('users/notify/list', { sinceId: olderId }, alice);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.length, 1);
		assert.strictEqual(res.body[0].id, newerId);
	});

	test('未認証の場合はエラー', async () => {
		const res = await api('users/notify/list', {});
		assert.strictEqual(res.status, 401);
	});
});
