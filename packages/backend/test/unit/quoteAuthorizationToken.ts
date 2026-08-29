/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import { describe, test } from 'vitest';
import { decodeQuoteAuthorizationToken, encodeQuoteAuthorizationToken } from '@/core/activitypub/misc/quoteAuthorizationToken.js';
import { getApId, isQuoteRequest } from '@/core/activitypub/type.js';

describe('quoteAuthorizationToken', () => {
	test('roundtrip', () => {
		const interactingObject = 'https://mastodon.example/users/foo/updates/1234';
		const noteId = '9abzW5cdef0';
		const token = encodeQuoteAuthorizationToken(interactingObject, noteId);
		assert.deepStrictEqual(decodeQuoteAuthorizationToken(token), { interactingObject, noteId });
	});

	test('rejects empty token', () => {
		assert.strictEqual(decodeQuoteAuthorizationToken(''), null);
	});

	test('rejects malformed token', () => {
		const garbage = Buffer.from('not a json').toString('base64url');
		assert.strictEqual(decodeQuoteAuthorizationToken(garbage), null);
	});

	test('rejects wrong shape', () => {
		const obj = Buffer.from(JSON.stringify({ interactingObject: 'https://example.com/a' })).toString('base64url');
		assert.strictEqual(decodeQuoteAuthorizationToken(obj), null);

		const tooShort = Buffer.from(JSON.stringify(['https://example.com/a'])).toString('base64url');
		assert.strictEqual(decodeQuoteAuthorizationToken(tooShort), null);

		const notStrings = Buffer.from(JSON.stringify([1, 2])).toString('base64url');
		assert.strictEqual(decodeQuoteAuthorizationToken(notStrings), null);
	});

	test('rejects too long token', () => {
		const long = 'A'.repeat(5000);
		assert.strictEqual(decodeQuoteAuthorizationToken(long), null);
	});
});

describe('isQuoteRequest', () => {
	test('detects QuoteRequest', () => {
		const activity = {
			type: 'QuoteRequest',
			actor: 'https://mastodon.example/users/foo',
			object: 'https://misskey.example/notes/123',
			instrument: 'https://mastodon.example/users/foo/updates/1234',
		};
		assert.strictEqual(isQuoteRequest(activity), true);
	});

	test('does not detect other activities', () => {
		assert.strictEqual(isQuoteRequest({ type: 'Create' }), false);
		assert.strictEqual(isQuoteRequest({ type: 'Accept' }), false);
	});

	test('getApId handles instrument forms', () => {
		assert.strictEqual(getApId('https://mastodon.example/users/foo/updates/1234'), 'https://mastodon.example/users/foo/updates/1234');
		assert.strictEqual(getApId({ type: 'Note', id: 'https://mastodon.example/users/foo/updates/1234' }), 'https://mastodon.example/users/foo/updates/1234');
	});
});
