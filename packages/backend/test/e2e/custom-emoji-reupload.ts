/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { afterAll, beforeAll, describe, test } from 'vitest';
import {
	api,
	failedApiCall,
	role,
	signup,
	startJobQueue,
	uploadFile,
} from '../utils.js';
import type { INestApplicationContext } from '@nestjs/common';
import type * as misskey from 'misskey-js';

describe('custom-emoji-reupload', () => {
	let queue: INestApplicationContext;
	let root: misskey.entities.SignupResponse;
	let otherAdmin: misskey.entities.SignupResponse;
	let roleAdmin: misskey.entities.Role;

	beforeAll(async () => {
		queue = await startJobQueue();
		root = await signup({ username: 'root' });
		otherAdmin = await signup({ username: 'other_admin' });

		roleAdmin = await role(root, { isAdministrator: true, name: 'Admin Role' }, {
			canManageCustomEmojis: { priority: 0, useDefault: false, value: true },
		});
		await api('admin/roles/assign', { userId: root.id, roleId: roleAdmin.id }, root);
		await api('admin/roles/assign', { userId: otherAdmin.id, roleId: roleAdmin.id }, root);
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await queue?.close();
	});

	test('絵文字登録時にファイルがシステムユーザーとして再アップロードされ、元ファイルは削除される', async () => {
		const upRes = await uploadFile(root, { path: '192.jpg' });
		assert.strictEqual(upRes.status, 200);
		const originalFile = upRes.body!;
		const emojiName = 'test_reupload_' + originalFile.id.slice(0, 6);

		const addRes = await api('admin/emoji/add', {
			name: emojiName,
			fileId: originalFile.id,
		}, root);
		assert.strictEqual(addRes.status, 200);
		const emoji = addRes.body!;

		// 再アップロードされた URL は元とは異なる
		assert.notStrictEqual(emoji.url, originalFile.url);

		// 元ファイルは削除済み
		await failedApiCall({
			endpoint: 'drive/files/show',
			parameters: { fileId: originalFile.id },
			user: root,
		}, {
			status: 400,
			code: 'NO_SUCH_FILE',
			id: '067bc436-2718-4795-b0fb-ecbe43949e31',
		});

		// 新しいファイルの URL は参照可能
		const fetchRes = await fetch(emoji.url);
		assert.strictEqual(fetchRes.status, 200);

		// 絵文字一覧に存在する
		const listRes = await api('admin/emoji/list', { query: emojiName }, root);
		assert.strictEqual(listRes.status, 200);
		assert.ok(listRes.body!.some((e: misskey.entities.EmojiDetailed) => e.name === emojiName));
	});

	test('絵文字登録者がアカウントを削除しても絵文字が残る', async () => {
		const uploader = await signup({ username: 'uploader' });
		await api('admin/roles/assign', { userId: uploader.id, roleId: roleAdmin.id }, root);

		const upRes = await uploadFile(uploader, { path: '192.jpg' });
		assert.strictEqual(upRes.status, 200);
		const originalFile = upRes.body!;
		const emojiName = 'test_survive_' + originalFile.id.slice(0, 6);

		const addRes = await api('admin/emoji/add', {
			name: emojiName,
			fileId: originalFile.id,
		}, uploader);
		assert.strictEqual(addRes.status, 200);
		const emoji = addRes.body!;

		// アカウント削除前に uploader のファイルをアップロード（削除ジョブ完了確認用）
		const refUpRes = await uploadFile(uploader, { path: '192.png' });
		assert.strictEqual(refUpRes.status, 200);
		const refFile = refUpRes.body!;

		// uploader のアカウントを削除
		const delRes = await api('i/delete-account', { password: 'test' }, uploader);
		assert.strictEqual(delRes.status, 204);

		// キュージョブの処理開始を待つ
		await new Promise(r => setTimeout(r, 1000));

		// uploader のファイルが消えるまでポーリング（削除ジョブ完了を待つ）
		const start = Date.now();
		const timeout = 30000;
		while (true) {
			const res = await fetch(refFile.url);
			if (res.status !== 200) break;
			if (Date.now() - start > timeout) {
				throw new Error('Timeout waiting for account deletion job to complete');
			}
			await new Promise(r => setTimeout(r, 500));
		}

		// otherAdmin で絵文字が残っていることを確認
		const listRes = await api('admin/emoji/list', { query: emojiName }, otherAdmin);
		assert.strictEqual(listRes.status, 200);
		assert.ok(listRes.body!.some((e: misskey.entities.EmojiDetailed) => e.name === emojiName));

		// 絵文字の URL も参照可能
		const fetchRes = await fetch(emoji.url);
		assert.strictEqual(fetchRes.status, 200);
	});
});
