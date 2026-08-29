/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';

import { describe, test } from 'vitest';

import { generateQuoteAuthorizationToken, QUOTE_AUTHORIZATION_TOKEN_BYTES } from '@/core/activitypub/misc/quoteAuthorizationToken.js';

describe('QuoteAuthorizationToken', () => {
	test('base64url形式で生成される', () => {
		const token = generateQuoteAuthorizationToken();
		assert.match(token, /^[A-Za-z0-9_-]+$/);
	});

	test('指定バイト数に対応する長さになる', () => {
		const token = generateQuoteAuthorizationToken();
		const expectedLength = Math.ceil(QUOTE_AUTHORIZATION_TOKEN_BYTES * 8 / 6);
		assert.strictEqual(token.length, expectedLength);
	});

	test('毎回異なる値になる', () => {
		const tokens = new Set<string>();
		for (let i = 0; i < 100; i++) {
			tokens.add(generateQuoteAuthorizationToken());
		}
		assert.strictEqual(tokens.size, 100);
	});
});
