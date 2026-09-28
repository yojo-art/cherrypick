/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { maskMetaSecrets, maskSecretValue } from '@/misc/mask-secret.js';
import { META_SECRET_FIELDS } from '@/misc/meta-secret-fields.js';

describe('misc:maskSecretValue', () => {
	test('null の場合は null を返す', () => {
		expect(maskSecretValue(null)).toBeNull();
	});

	test('空文字列の場合は空文字列を返す', () => {
		expect(maskSecretValue('')).toBe('');
	});

	test('長さに関わらず値全体を固定長でマスクする', () => {
		expect(maskSecretValue('a')).toBe('*'.repeat(32));
		expect(maskSecretValue('abcd')).toBe('*'.repeat(32));
		expect(maskSecretValue('abcdefghij')).toBe('*'.repeat(32));
		expect(maskSecretValue('x'.repeat(100))).toBe('*'.repeat(32));
	});
});

describe('misc:maskMetaSecrets', () => {
	test('非オブジェクト値はそのまま返す', () => {
		expect(maskMetaSecrets(null)).toBeNull();
		expect(maskMetaSecrets('string')).toBe('string');
		expect(maskMetaSecrets(123)).toBe(123);
	});

	test('メタ情報のシークレットフィールドをマスクする', () => {
		const meta = {
			hcaptchaSecretKey: 'very-long-secret-key',
			turnstileSecretKey: 'short',
			smtpPass: null,
			swPrivateKey: undefined,
		};
		const masked = maskMetaSecrets(meta) as typeof meta;
		expect(masked.hcaptchaSecretKey).toBe('*'.repeat(32));
		expect(masked.turnstileSecretKey).toBe('*'.repeat(32));
		expect(masked.smtpPass).toBeNull();
		expect(masked.swPrivateKey).toBeUndefined();
	});

	test('シークレットでないフィールドは変更しない', () => {
		const meta = {
			name: 'instance name',
			enableHcaptcha: true,
			hcaptchaSiteKey: 'public-site-key',
		};
		const masked = maskMetaSecrets(meta) as typeof meta;
		expect(masked.name).toBe('instance name');
		expect(masked.enableHcaptcha).toBe(true);
		expect(masked.hcaptchaSiteKey).toBe('public-site-key');
	});

	test('定義されたすべてのシークレットフィールドをカバーする', () => {
		const meta: Record<string, string | null> = {};
		for (const key of META_SECRET_FIELDS) {
			meta[key] = 'secret-value';
		}
		const masked = maskMetaSecrets(meta) as Record<string, string>;
		for (const key of META_SECRET_FIELDS) {
			expect(masked[key]).toBe('*'.repeat(32));
		}
	});
});
