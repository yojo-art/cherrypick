/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'node:assert';
import { describe, beforeAll, afterAll, test } from 'vitest';
import { api, role, signup } from '../../utils.js';
import type * as misskey from 'misskey-js';

describe('/admin/meta エンドポイント', () => {
	let admin: misskey.entities.SignupResponse;

	const secretFields = [
		'hcaptchaSecretKey',
		'mcaptchaSecretKey',
		'recaptchaSecretKey',
		'turnstileSecretKey',
		'smtpPass',
		'swPrivateKey',
		'objectStorageSecretKey',
		'deeplAuthKey',
		'verifymailAuthKey',
		'truemailAuthKey',
		'remoteObjectStorageSecretKey',
		'ctav3SaKey',
		'libreTranslateApiKey',
	] as const;

	const clearSecrets = () => {
		const params: Partial<misskey.Endpoints['admin/update-meta']['req']> = {};
		for (const field of secretFields) {
			(params as Record<string, null>)[field] = null;
		}
		return params;
	};

	beforeAll(async () => {
		admin = await signup({ username: 'admin' });
		await role(admin, { isAdministrator: true });
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await api('admin/update-meta', clearSecrets(), admin);
	});

	test('シークレットキーが設定されている場合、レスポンスに生の値が含まれず hasXxx が true となる', async () => {
		const params: Partial<misskey.Endpoints['admin/update-meta']['req']> = {};
		for (const field of secretFields) {
			(params as Record<string, string>)[field] = `test-${field}`;
		}
		await api('admin/update-meta', params, admin);

		const res = await api('admin/meta', {}, admin);
		assert.strictEqual(res.status, 200);

		const body = res.body as Record<string, unknown>;
		for (const field of secretFields) {
			assert.strictEqual(body[field], undefined, `${field} がレスポンスに含まれないこと`);
			const hasField = `has${field.charAt(0).toUpperCase()}${field.slice(1)}`;
			assert.strictEqual(body[hasField], true, `${hasField} が true であること`);
		}
	});

	test('シークレットキーが未設定の場合、hasXxx が false となる', async () => {
		await api('admin/update-meta', clearSecrets(), admin);

		const res = await api('admin/meta', {}, admin);
		assert.strictEqual(res.status, 200);

		const body = res.body as Record<string, unknown>;
		for (const field of secretFields) {
			const hasField = `has${field.charAt(0).toUpperCase()}${field.slice(1)}`;
			assert.strictEqual(body[hasField], false, `${hasField} が false であること`);
		}
	});

	test('サイトキーなどの公開情報はレスポンスに含まれる', async () => {
		await api('admin/update-meta', {
			hcaptchaSiteKey: 'hcaptcha-site-key',
			recaptchaSiteKey: 'recaptcha-site-key',
		}, admin);

		const res = await api('admin/meta', {}, admin);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.hcaptchaSiteKey, 'hcaptcha-site-key');
		assert.strictEqual(res.body.recaptchaSiteKey, 'recaptcha-site-key');
	});
});
