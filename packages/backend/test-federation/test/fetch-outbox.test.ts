import { deepStrictEqual, strictEqual } from 'assert';
import * as Misskey from 'cherrypick-js';
import { createAccount, type LoginUser, resolveRemoteUser } from './utils.js';

describe('fetch-outbox', () => {
	let alice: LoginUser, bob: LoginUser;
	let bobInAliceHost: Misskey.entities.UserDetailedNotMe;
	let bobNote: Misskey.entities.Note, bobRenote: Misskey.entities.Note;

	beforeAll(async () => {
		[alice, bob] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
		]);

		[bobInAliceHost] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
		]);
		bobNote = (await bob.client.request('notes/create', { text: 'I am Bob!' })).createdNote;
		bobRenote = (await bob.client.request('notes/create', { renoteId: bobNote.id })).createdNote;
	});
	test('New User', async () => {
		await alice.client.request('ap/fetch-outbox', { userId: bobInAliceHost.id, wait: true });
		const fetch_notes = await alice.client.request('users/notes', { userId: bobInAliceHost.id, withReplies: false, withRenotes: true });
		strictEqual(fetch_notes.length, 2, JSON.stringify(fetch_notes));
		deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
			return {
				text: note.text,
				createdAt: note.createdAt,
			};
		})), JSON.stringify([
			{
				text: bobRenote.text,
				createdAt: bobRenote.createdAt,
			}, {
				text: bobNote.text,
				createdAt: bobNote.createdAt,
			},
		]));
		strictEqual(fetch_notes[0].renote?.id, fetch_notes[1].id);
	});
	test('Know User (cache hit)', async () => {
		//キャッシュを利用するためこのノートは取得されない
		await bob.client.request('notes/create', { text: 'Bob Note 2' });
		await alice.client.request('ap/fetch-outbox', { userId: bobInAliceHost.id, wait: true });
		const fetch_notes = await alice.client.request('users/notes', { userId: bobInAliceHost.id, withReplies: false, withRenotes: true });
		//一度取得したノートは破棄されない
		strictEqual(fetch_notes.length, 2, JSON.stringify(fetch_notes));
		deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
			return {
				text: note.text,
				createdAt: note.createdAt,
			};
		})), JSON.stringify([
			{
				text: bobRenote.text,
				createdAt: bobRenote.createdAt,
			}, {
				text: bobNote.text,
				createdAt: bobNote.createdAt,
			},
		]));
		strictEqual(fetch_notes[0].renote?.id, fetch_notes[1].id);
	});
});
