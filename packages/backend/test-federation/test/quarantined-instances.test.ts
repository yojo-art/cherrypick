import { deepStrictEqual, strictEqual } from 'assert';
import * as Misskey from 'cherrypick-js';
import { createAccount, fetchAdmin, type LoginUser, resolveRemoteUser, sleep } from './utils.js';

describe('quarantine instance', () => {
	let alice: LoginUser, bob: LoginUser;
	let aliceInBobHost: Misskey.entities.UserDetailedNotMe, bobInBobHost: Misskey.entities.UserDetailedNotMe;
	let bAdmin: LoginUser;

	beforeAll(async () => {
		[alice, bob] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
		]);

		[aliceInBobHost, bobInBobHost] = await Promise.all([
			resolveRemoteUser('a.test', alice.id, bob),
			resolveRemoteUser('b.test', bob.id, alice),
		]);
		await bob.client.request('following/create', { userId: aliceInBobHost.id });
		bAdmin = await fetchAdmin('b.test');
		await sleep();
	});
	test('isQuarantineLimit true', async () => {
		await bAdmin.client.request('admin/federation/update-instance', { host: 'a.test', isQuarantineLimit: true });

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
		strictEqual(fetch_notes.length, 2, JSON.stringify(fetch_notes));
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
		await bAdmin.client.request('admin/federation/update-instance', { host: 'a.test', isQuarantineLimit: false });

		const alicePublicNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'I am Alice!' })).createdNote;
		const alicePublicRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id })).createdNote;
		const aliceHomeNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'home note', visibility: 'home' })).createdNote;
		const aliceHomeRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'home' })).createdNote;
		const aliceFollowersNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'followers note', visibility: 'followers' })).createdNote;
		const aliceFollowersRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'followers' })).createdNote;
		const aliceSpecifiedNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'specified note', visibility: 'specified', visibleUserIds: [bobInBobHost.id] })).createdNote;
		const aliceSpecifiedRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'specified', visibleUserIds: [bobInBobHost.id] })).createdNote;

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
				text: aliceSpecifiedRenote.text,
				createdAt: aliceSpecifiedRenote.createdAt,
			}, {
				text: aliceSpecifiedNote.text,
				createdAt: aliceSpecifiedNote.createdAt,
			},
			{
				text: aliceFollowersRenote.text,
				createdAt: aliceFollowersRenote.createdAt,
			}, {
				text: aliceFollowersNote.text,
				createdAt: aliceFollowersNote.createdAt,
			},
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
		strictEqual(fetch_notes[0].renote?.id, fetch_notes[7].id);
		strictEqual(fetch_notes[2].renote?.id, fetch_notes[7].id);
		strictEqual(fetch_notes[4].renote?.id, fetch_notes[7].id);
		strictEqual(fetch_notes[6].renote?.id, fetch_notes[7].id);
	});
});
