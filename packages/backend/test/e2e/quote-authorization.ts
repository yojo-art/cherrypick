/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, beforeAll, test } from 'vitest';
import { Repository } from 'typeorm';
import { MiNote } from '@/models/Note.js';
import { MiQuoteAuthorization } from '@/models/QuoteAuthorization.js';
import { initTestDb, origin, post, relativeFetch, signup, sleep, api } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('Quote authorization (FEP-044f)', () => {
	let quoteAuthorizations: Repository<MiQuoteAuthorization>;

	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;

	const interactingObject = 'https://remote.example.com/notes/0123456789';

	const token = {
		public: 'aaaaaaaapublictoken0000000000000',
		home: 'aaaaaaaahometoken00000000000000000',
		followers: 'aaaaaaaafollowerstoken00000000000',
		localOnly: 'aaaaaaaalocalonlytoken0000000000',
	} as const;

	let publicNote: misskey.entities.Note;
	let homeNote: misskey.entities.Note;
	let followersNote: misskey.entities.Note;
	let localOnlyNote: misskey.entities.Note;

	function getPath(userId: string, authorizationToken: string): string {
		return `/users/${userId}/quote_authorizations/${authorizationToken}`;
	}

	beforeAll(async () => {
		const db = await initTestDb(true);
		quoteAuthorizations = db.getRepository(MiQuoteAuthorization);

		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		await api('admin/update-meta', { federation: 'all' }, alice);

		publicNote = await post(alice, { text: 'public', visibility: 'public' });
		homeNote = await post(alice, { text: 'home', visibility: 'home' });
		followersNote = await post(alice, { text: 'followers', visibility: 'followers' });
		const localOnlyNoteCreated = await post(alice, { text: 'localOnly', visibility: 'public' });
		// notes/create では localOnly を設定できないためDB上で直接立てる
		await db.getRepository(MiNote).update({ id: localOnlyNoteCreated.id }, { localOnly: true });
		localOnlyNote = localOnlyNoteCreated;

		await quoteAuthorizations.insert([
			{ id: `${publicNote.id}q1`, noteId: publicNote.id, token: token.public, interactingObject, requestedById: alice.id },
			{ id: `${homeNote.id}q1`, noteId: homeNote.id, token: token.home, interactingObject, requestedById: alice.id },
			{ id: `${followersNote.id}q1`, noteId: followersNote.id, token: token.followers, interactingObject, requestedById: alice.id },
			{ id: `${localOnlyNote.id}q1`, noteId: localOnlyNote.id, token: token.localOnly, interactingObject, requestedById: alice.id },
		]);
	}, 1000 * 60 * 2);

	test('public ノートの承認トークンは取得できる', async () => {
		const res = await relativeFetch(getPath(alice.id, token.public), {
			headers: { Accept: 'application/activity+json' },
		});

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.headers.get('cache-control'), 'private, max-age=180');

		const body = await res.json() as any;
		assert.strictEqual(body.type, 'QuoteAuthorization');
		assert.strictEqual(body.id, `${origin}/users/${alice.id}/quote_authorizations/${token.public}`);
		assert.strictEqual(body.attributedTo, `${origin}/users/${alice.id}`);
		assert.strictEqual(body.interactingObject, interactingObject);
		assert.strictEqual(body.interactionTarget, `${origin}/notes/${publicNote.id}`);
	});

	test('home ノートの承認トークンも取得できる', async () => {
		const res = await relativeFetch(getPath(alice.id, token.home), {
			headers: { Accept: 'application/activity+json' },
		});

		assert.strictEqual(res.status, 200);
	});

	test('フォロワー限定ノートの承認トークンは 404', async () => {
		const res = await relativeFetch(getPath(alice.id, token.followers), {
			headers: { Accept: 'application/activity+json' },
		});

		assert.strictEqual(res.status, 404);
	});

	test('localOnly ノートの承認トークンは 404', async () => {
		const res = await relativeFetch(getPath(alice.id, token.localOnly), {
			headers: { Accept: 'application/activity+json' },
		});

		assert.strictEqual(res.status, 404);
	});

	test('存在しないトークンは 404', async () => {
		const res = await relativeFetch(getPath(alice.id, 'nosuchtoken00000000000000000000000'), {
			headers: { Accept: 'application/activity+json' },
		});

		assert.strictEqual(res.status, 404);
	});

	test('パスのユーザーとノート作者が不一致なら 404', async () => {
		const res = await relativeFetch(getPath(bob.id, token.public), {
			headers: { Accept: 'application/activity+json' },
		});

		assert.strictEqual(res.status, 404);
	});

	test('federation が none なら 403', async () => {
		await api('admin/update-meta', { federation: 'none' }, alice);

		const res = await relativeFetch(getPath(alice.id, token.public), {
			headers: { Accept: 'application/activity+json' },
		});

		assert.strictEqual(res.status, 403);

		await api('admin/update-meta', { federation: 'all' }, alice);
		// update-meta の moderation log が fire-and-forget なので teardown 前に少し待つ
		await sleep(1000);
	});
});
