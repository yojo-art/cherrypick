/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, beforeAll, test } from 'vitest';
import { api, castAsError, role, signup, uploadFile } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('admin/custom-sounds', () => {
	let root: misskey.entities.SignupResponse;
	let alice: misskey.entities.SignupResponse;

	beforeAll(async () => {
		root = await signup({ username: 'root' });
		alice = await signup({ username: 'alice' });

		const rateLimitRole = await role(root, { name: 'No Rate Limit' }, {
			rateLimitFactor: { priority: 0, useDefault: false, value: 0 },
		});
		await api('admin/roles/assign', {
			roleId: rateLimitRole.id,
			userId: root.id,
		}, root);
		await api('admin/roles/assign', {
			roleId: rateLimitRole.id,
			userId: alice.id,
		}, root);
	}, 1000 * 60 * 2);

	async function setupSoundManager(user: misskey.entities.SignupResponse) {
		const soundRole = await role(root, { name: 'Sound Manager' }, {
			canManageCustomSounds: { priority: 0, useDefault: false, value: true },
		});
		await api('admin/roles/assign', {
			roleId: soundRole.id,
			userId: user.id,
		}, root);

		const rateLimitRole = await role(root, { name: 'No Rate Limit 2' }, {
			rateLimitFactor: { priority: 0, useDefault: false, value: 0 },
		});
		await api('admin/roles/assign', {
			roleId: rateLimitRole.id,
			userId: user.id,
		}, root);
	}

	async function uploadAudio(user: misskey.entities.SignupResponse, path = 'kick_gaba7.mp3', name = 'test-sound.mp3'): Promise<misskey.entities.DriveFile> {
		const res = await uploadFile(user, { path, name });
		assert.strictEqual(res.status, 200);
		return res.body as misskey.entities.DriveFile;
	}

	test('3つの音声ファイルを登録できる', async () => {
		const files = [
			await uploadAudio(root, 'kick_gaba7.mp3', 'kick_gaba7.mp3'),
			await uploadAudio(root, 'kick_gaba7.wav', 'kick_gaba7.wav'),
			await uploadAudio(root, 'kick_gaba7.aac', 'kick_gaba7.aac'),
		];

		const createdIds: string[] = [];
		for (const file of files) {
			const res = await api('admin/custom-sounds/create', {
				name: file.name,
				fileId: file.id,
			}, root);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.name, file.name);
			createdIds.push(res.body.id);
		}

		const listRes = await api('admin/custom-sounds/list', {}, root);
		assert.strictEqual(listRes.status, 200);
		for (const id of createdIds) {
			assert.ok(listRes.body.some(s => s.id === id));
		}

		// 公開取得でURLが解決されている
		const publicRes = await api('get-custom-sounds', {});
		assert.strictEqual(publicRes.status, 200);
		for (const id of createdIds) {
			const sound = publicRes.body.find(s => s.id === id);
			assert.ok(sound);
			assert.ok(sound.url != null, `url should be resolved for ${id}`);
		}
	});

	test('権限のないユーザーは作成できない', async () => {
		const file = await uploadAudio(alice);
		const res = await api('admin/custom-sounds/create', {
			name: 'test',
			fileId: file.id,
		}, alice);
		assert.strictEqual(res.status, 403);
	});

	test('canManageCustomSounds ポリシーを持つユーザーは作成できる', async () => {
		const manager = await signup({ username: 'soundManager' });
		await setupSoundManager(manager);
		const file = await uploadAudio(manager);
		const res = await api('admin/custom-sounds/create', {
			name: 'manager-sound',
			fileId: file.id,
		}, manager);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.name, 'manager-sound');
	});

	test('管理者はサウンドを作成・一覧・公開取得できる', async () => {
		const file = await uploadAudio(root);
		const createRes = await api('admin/custom-sounds/create', {
			name: 'test-sound',
			fileId: file.id,
		}, root);
		assert.strictEqual(createRes.status, 200);
		assert.strictEqual(createRes.body.name, 'test-sound');
		assert.ok(createRes.body.id);

		const listRes = await api('admin/custom-sounds/list', {}, root);
		assert.strictEqual(listRes.status, 200);
		assert.ok(listRes.body.some(s => s.id === createRes.body.id));

		// 公開取得はログイン不要
		const publicRes = await api('get-custom-sounds', {});
		assert.strictEqual(publicRes.status, 200);
		assert.ok(publicRes.body.some(s => s.id === createRes.body.id));

		return createRes.body.id;
	});

	test('音声以外のファイルは作成できない', async () => {
		const fileRes = await uploadFile(root, { path: '192.jpg', name: 'not-audio.jpg' });
		assert.strictEqual(fileRes.status, 200);
		const res = await api('admin/custom-sounds/create', {
			name: 'test-image',
			fileId: (fileRes.body as misskey.entities.DriveFile).id,
		}, root);
		assert.strictEqual(res.status, 400);
	});

	test('存在しないファイルでは作成できない', async () => {
		const res = await api('admin/custom-sounds/create', {
			name: 'test',
			fileId: '00000000000000000000000000',
		}, root);
		assert.strictEqual(res.status, 400);
	});

	test('同じファイルで重複登録はできない', async () => {
		const file = await uploadAudio(root);
		const first = await api('admin/custom-sounds/create', {
			name: 'first-sound',
			fileId: file.id,
		}, root);
		assert.strictEqual(first.status, 200);

		const second = await api('admin/custom-sounds/create', {
			name: 'second-sound',
			fileId: file.id,
		}, root);
		assert.strictEqual(second.status, 400);
		assert.strictEqual(castAsError(second.body as any).error.code, 'FILE_ALREADY_USED');
	});

	test('削除できる', async () => {
		const file = await uploadAudio(root);
		const createRes = await api('admin/custom-sounds/create', {
			name: 'to-delete',
			fileId: file.id,
		}, root);
		assert.strictEqual(createRes.status, 200);

		const deleteRes = await api('admin/custom-sounds/delete', { id: createRes.body.id }, root);
		assert.strictEqual(deleteRes.status, 204);

		const listRes = await api('admin/custom-sounds/list', {}, root);
		assert.ok(!listRes.body.some(s => s.id === createRes.body.id));
	});

	test('存在しないサウンドの削除はエラー', async () => {
		const res = await api('admin/custom-sounds/delete', { id: '00000000000000000000000000' }, root);
		assert.strictEqual(res.status, 400);
	});
});
