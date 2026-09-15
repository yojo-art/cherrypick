/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { beforeAll, describe, expect, test } from 'vitest';
import { api, failedApiCall, role, signup, successfulApiCall } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('users/stats', () => {
	let root: misskey.entities.SignupResponse;
	let otherAdmin: misskey.entities.SignupResponse;
	let normalUser: misskey.entities.SignupResponse;
	let victim: misskey.entities.SignupResponse;

	beforeAll(async () => {
		root = await signup({ username: 'statsRoot' });
		otherAdmin = await signup({ username: 'statsOtherAdmin' });
		normalUser = await signup({ username: 'statsNormal' });
		victim = await signup({ username: 'statsVictim' });

		const roleAdmin = await role(root, { isAdministrator: true, name: 'Admin Role (users/stats)' });
		await api('admin/roles/assign', { userId: otherAdmin.id, roleId: roleAdmin.id }, root);
	}, 1000 * 60 * 2);

	test('本人は自分の統計情報を取得できる', async () => {
		const res = await successfulApiCall({
			endpoint: 'users/stats',
			parameters: { userId: normalUser.id },
			user: normalUser,
		}, {
			status: 200,
		});

		expect(res).toHaveProperty('notesCount');
		expect(res).toHaveProperty('driveUsage');
	});

	test('管理者は他ユーザーの統計情報を取得できる', async () => {
		const res = await successfulApiCall({
			endpoint: 'users/stats',
			parameters: { userId: victim.id },
			user: otherAdmin,
		}, {
			status: 200,
		});

		expect(res).toHaveProperty('notesCount');
	});

	test('管理者は自分自身の統計情報を取得できる', async () => {
		await successfulApiCall({
			endpoint: 'users/stats',
			parameters: { userId: otherAdmin.id },
			user: otherAdmin,
		}, {
			status: 200,
		});
	});

	test('一般ユーザーが他ユーザーの統計情報を取得すると PERMISSION_DENIED エラーになる', async () => {
		await failedApiCall({
			endpoint: 'users/stats',
			parameters: { userId: victim.id },
			user: normalUser,
		}, {
			status: 403,
			code: 'PERMISSION_DENIED',
			id: '7ff2224a-677b-4e0b-828e-e337b859978f',
		});
	});

	test('存在しないユーザーの統計情報取得は失敗する', async () => {
		await failedApiCall({
			endpoint: 'users/stats',
			parameters: { userId: '0006fhc087yi0000' },
			user: normalUser,
		}, {
			status: 400,
			code: 'NO_SUCH_USER',
			id: '9e638e45-3b25-4ef7-8f95-07e8498f1819',
		});
	});

	test('未認証で統計情報を取得すると CREDENTIAL_REQUIRED エラーになる', async () => {
		await failedApiCall({
			endpoint: 'users/stats',
			parameters: { userId: normalUser.id },
			user: undefined,
		}, {
			status: 401,
			code: 'CREDENTIAL_REQUIRED',
			id: '1384574d-a912-4b81-8601-c7b1c4085df1',
		});
	});
});
