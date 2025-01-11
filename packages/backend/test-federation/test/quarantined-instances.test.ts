import { deepStrictEqual, strictEqual } from 'assert';
import * as Misskey from 'cherrypick-js';
import { createAccount, fetchAdmin, type LoginUser, resolveRemoteUser, sleep } from './utils.js';

describe('quarantine instance', () => {
	let alice: LoginUser, bob: LoginUser, carol:LoginUser;
	let aliceInBobHost: Misskey.entities.UserDetailedNotMe, bobInBobHost: Misskey.entities.UserDetailedNotMe, carolInBobHost: Misskey.entities.UserDetailedNotMe;
	let bAdmin: LoginUser;

	beforeAll(async () => {
		[alice, bob, carol] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
			createAccount('a.test'),
		]);

		[aliceInBobHost, bobInBobHost, carolInBobHost] = await Promise.all([
			resolveRemoteUser('a.test', alice.id, bob),
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('a.test', carol.id, bob),
		]);
		await bob.client.request('following/create', { userId: aliceInBobHost.id });
		bAdmin = await fetchAdmin('b.test');
		await sleep();
	});
	test('isQuarantineLimit true', async () => {
		await bAdmin.client.request('admin/federation/update-instance', { host: 'a.test', isQuarantineLimit: true }, bAdmin.i);

		const alicePublicNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'I am Alice!' })).createdNote;
		const alicePublicRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id })).createdNote;
		const aliceHomeNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'home note', visibility: 'home' })).createdNote;
		const aliceHomeRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'home' })).createdNote;
		(await alice.client.request('notes/create', { text: 'followers note', visibility: 'followers' })).createdNote;
		(await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'followers' })).createdNote;
		(await alice.client.request('notes/create', { text: 'specified note', visibility: 'specified', visibleUserIds: [bobInBobHost.id] })).createdNote;
		(await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'specified', visibleUserIds: [bobInBobHost.id] })).createdNote;

		await sleep();
		const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
		strictEqual(fetch_notes.length, 4, JSON.stringify(fetch_notes));
		deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
			return {
				text: note.text,
				createdAt: note.createdAt,
			};
		})), JSON.stringify([
			{
				text: aliceHomeRenote.text,
				createdAt: aliceHomeRenote.createdAt,
			}, {
				text: aliceHomeNote.text,
				createdAt: aliceHomeNote.createdAt,
			},
			{
				text: alicePublicRenote.text,
				createdAt: alicePublicRenote.createdAt,
			}, {
				text: alicePublicNote.text,
				createdAt: alicePublicNote.createdAt,
			},
		]));
		strictEqual(fetch_notes[0].renote?.id, fetch_notes[1].id);
	});
	test('isQuarantineLimit false', async () => {
		await bAdmin.client.request('admin/federation/update-instance', { host: 'a.test', isQuarantineLimit: false }, bAdmin.i);

		const carolPublicNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'I am Carol!' })).createdNote;
		const carolPublicRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: carolPublicNote.id })).createdNote;
		const carolHomeNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'home note', visibility: 'home' })).createdNote;
		const carolHomeRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: carolPublicNote.id, visibility: 'home' })).createdNote;
		const carolFollowersNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'followers note', visibility: 'followers' })).createdNote;
		const carolFollowersRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: carolPublicNote.id, visibility: 'followers' })).createdNote;
		const carolSpecifiedNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'specified note', visibility: 'specified', visibleUserIds: [bobInBobHost.id] })).createdNote;
		const carolSpecifiedRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: carolPublicNote.id, visibility: 'specified', visibleUserIds: [bobInBobHost.id] })).createdNote;

		await sleep();
		const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
		strictEqual(fetch_notes.length, 8, JSON.stringify(fetch_notes));
		deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
			return {
				text: note.text,
				createdAt: note.createdAt,
			};
		})), JSON.stringify([
			{
				text: carolSpecifiedRenote.text,
				createdAt: carolSpecifiedRenote.createdAt,
			}, {
				text: carolSpecifiedNote.text,
				createdAt: carolSpecifiedNote.createdAt,
			},
			{
				text: carolFollowersRenote.text,
				createdAt: carolFollowersRenote.createdAt,
			}, {
				text: carolFollowersNote.text,
				createdAt: carolFollowersNote.createdAt,
			},
			{
				text: carolHomeRenote.text,
				createdAt: carolHomeRenote.createdAt,
			}, {
				text: carolHomeNote.text,
				createdAt: carolHomeNote.createdAt,
			},
			{
				text: carolPublicRenote.text,
				createdAt: carolPublicRenote.createdAt,
			}, {
				text: carolPublicNote.text,
				createdAt: carolPublicNote.createdAt,
			},
		]));
		strictEqual(fetch_notes[0].renote?.id, fetch_notes[7].id);
		strictEqual(fetch_notes[2].renote?.id, fetch_notes[7].id);
		strictEqual(fetch_notes[4].renote?.id, fetch_notes[7].id);
		strictEqual(fetch_notes[6].renote?.id, fetch_notes[7].id);
	});
});
