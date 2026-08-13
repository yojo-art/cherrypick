/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'node:assert';
import { beforeAll, describe, test } from 'vitest';
import { api, failedApiCall, role, signup, successfulApiCall } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('admin/suspend-user', () => {
	let root: misskey.entities.SignupResponse;
	let otherAdmin: misskey.entities.SignupResponse;
	let moderatorUser: misskey.entities.SignupResponse;
	let normalUser: misskey.entities.SignupResponse;
	let roleAdmin: misskey.entities.Role;
	let roleModerator: misskey.entities.Role;

	beforeAll(async () => {
		root = await signup({ username: 'root' });
		otherAdmin = await signup({ username: 'otherAdmin' });
		normalUser = await signup({ username: 'normal1' });
		moderatorUser = await signup({ username: 'moderator1' });

		roleAdmin = await role(root, { isAdministrator: true, name: 'Admin Role' });
		roleModerator = await role(root, { isModerator: true, name: 'Moderator Role' });
		await api('admin/roles/assign', { userId: otherAdmin.id, roleId: roleAdmin.id }, root);
		await api('admin/roles/assign', { userId: moderatorUser.id, roleId: roleModerator.id }, root);
	}, 1000 * 60 * 2);

	test('管理者が一般ユーザーをサスペンドできる', async () => {
		const target = await signup({ username: 'suspend_target1' });
		await successfulApiCall({
			endpoint: 'admin/suspend-user',
			parameters: {
				userId: target.id,
			},
			user: root,
		}, {
			status: 204,
		});

		const userInfo = await api('admin/show-user', { userId: target.id }, root);
		assert.strictEqual(userInfo.body.isSuspended, true);
	});

	test('他の管理者が一般ユーザーをサスペンドできる', async () => {
		const target = await signup({ username: 'suspend_target2' });
		await successfulApiCall({
			endpoint: 'admin/suspend-user',
			parameters: {
				userId: target.id,
			},
			user: otherAdmin,
		}, {
			status: 204,
		});

		const userInfo = await api('admin/show-user', { userId: target.id }, root);
		assert.strictEqual(userInfo.body.isSuspended, true);
	});

	test('モデレーターが一般ユーザーをサスペンドできる', async () => {
		const target = await signup({ username: 'suspend_target3' });
		await successfulApiCall({
			endpoint: 'admin/suspend-user',
			parameters: {
				userId: target.id,
			},
			user: moderatorUser,
		}, {
			status: 204,
		});

		const userInfo = await api('admin/show-user', { userId: target.id }, root);
		assert.strictEqual(userInfo.body.isSuspended, true);
	});

	test('管理者が他の管理者をサスペンドしようとするとエラーになる', async () => {
		const res = await api('admin/suspend-user', {
			userId: otherAdmin.id,
		}, root);

		assert.strictEqual(res.status, 500);
		assert.ok(res.body);
		assert.strictEqual((res.body as any).error.code, 'INTERNAL_ERROR');
		assert.strictEqual((res.body as any).error.info.e.message, 'cannot suspend moderator account');
	});

	test('管理者がモデレーターをサスペンドしようとするとエラーになる', async () => {
		const res = await api('admin/suspend-user', {
			userId: moderatorUser.id,
		}, root);

		assert.strictEqual(res.status, 500);
		assert.ok(res.body);
		assert.strictEqual((res.body as any).error.code, 'INTERNAL_ERROR');
		assert.strictEqual((res.body as any).error.info.e.message, 'cannot suspend moderator account');
	});

	test('モデレーターが他のモデレーターをサスペンドしようとするとエラーになる', async () => {
		const otherModerator = await signup({ username: 'otherModerator' });
		await api('admin/roles/assign', { userId: otherModerator.id, roleId: roleModerator.id }, root);

		const res = await api('admin/suspend-user', {
			userId: otherModerator.id,
		}, moderatorUser);

		assert.strictEqual(res.status, 500);
		assert.ok(res.body);
		assert.strictEqual((res.body as any).error.code, 'INTERNAL_ERROR');
		assert.strictEqual((res.body as any).error.info.e.message, 'cannot suspend moderator account');
	});

	test('モデレーターが管理者をサスペンドしようとするとエラーになる', async () => {
		const res = await api('admin/suspend-user', {
			userId: otherAdmin.id,
		}, moderatorUser);

		assert.strictEqual(res.status, 500);
		assert.ok(res.body);
		assert.strictEqual((res.body as any).error.code, 'INTERNAL_ERROR');
		assert.strictEqual((res.body as any).error.info.e.message, 'cannot suspend moderator account');
	});

	test('管理者が自分自身をサスペンドしようとするとエラーになる', async () => {
		const res = await api('admin/suspend-user', {
			userId: root.id,
		}, root);

		assert.strictEqual(res.status, 500);
		assert.ok(res.body);
		assert.strictEqual((res.body as any).error.code, 'INTERNAL_ERROR');
		assert.strictEqual((res.body as any).error.info.e.message, 'cannot suspend moderator account');
	});

	test('存在しないユーザーをサスペンドしようとするとエラーになる', async () => {
		const res = await api('admin/suspend-user', {
			userId: '0006fhc087yi0000',
		}, root);

		assert.strictEqual(res.status, 500);
		assert.ok(res.body);
		assert.strictEqual((res.body as any).error.code, 'INTERNAL_ERROR');
		assert.strictEqual((res.body as any).error.info.e.message, 'user not found');
	});

	test('ログインしていないユーザーがサスペンドを試みると失敗する', async () => {
		await failedApiCall({
			endpoint: 'admin/suspend-user',
			parameters: {
				userId: normalUser.id,
			},
			user: undefined,
		}, {
			status: 401,
			code: 'CREDENTIAL_REQUIRED',
			id: '1384574d-a912-4b81-8601-c7b1c4085df1',
		});
	});

	test('一般ユーザーがサスペンドを試みると失敗する', async () => {
		await failedApiCall({
			endpoint: 'admin/suspend-user',
			parameters: {
				userId: normalUser.id,
			},
			user: normalUser,
		}, {
			status: 403,
			code: 'ROLE_PERMISSION_DENIED',
			id: 'd33d5333-db36-423d-a8f9-1a2b9549da41',
		});
	});
});
