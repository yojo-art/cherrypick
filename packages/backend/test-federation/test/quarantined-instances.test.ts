import { deepStrictEqual, strictEqual } from 'assert';
import * as Misskey from 'cherrypick-js';
import { createAccount, fetchAdmin, type LoginUser, resolveRemoteUser, sleep } from './utils.js';

describe('quarantine instance', () => {
	let alice: LoginUser, bob: LoginUser, carol:LoginUser;
	let aliceInBobHost: Misskey.entities.UserDetailedNotMe, bobInAliceHost: Misskey.entities.UserDetailedNotMe, carolInBobHost: Misskey.entities.UserDetailedNotMe;
	let aAdmin: LoginUser;

	beforeAll(async () => {
		[alice, bob, carol] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
			createAccount('a.test'),
		]);

		[aliceInBobHost, bobInAliceHost, carolInBobHost] = await Promise.all([
			resolveRemoteUser('a.test', alice.id, bob),
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('a.test', carol.id, bob),
		]);
		await bob.client.request('following/create', { userId: aliceInBobHost.id });
		aAdmin = await fetchAdmin('a.test');
		await sleep();
	});
	describe('isQuarantineLimit true', async () => {
		await aAdmin.client.request('admin/federation/update-instance', { host: 'a.test', isQuarantineLimit: true });
		const alicePublicNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'I am Alice!' })).createdNote;
		const alicePublicRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id })).createdNote;
		const expected :{text:string|null, createdAt:string}[] = [];
		expected.push({
			text: alicePublicNote.text,
			createdAt: alicePublicNote.createdAt,
		});
		expected.push({
			text: alicePublicRenote.text,
			createdAt: alicePublicRenote.createdAt,
		});
		await sleep();
		test('public', async () => {
			const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		const aliceHomeNote: Misskey.entities.Note = (await alice.client.request('notes/create', { text: 'home note', visibility: 'home' })).createdNote;
		const aliceHomeRenote: Misskey.entities.Note = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'home' })).createdNote;
		expected.push({
			text: aliceHomeNote.text,
			createdAt: aliceHomeNote.createdAt,
		});
		expected.push({
			text: aliceHomeRenote.text,
			createdAt: aliceHomeRenote.createdAt,
		});
		await sleep();
		test('home', async () => {
			const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		(await alice.client.request('notes/create', { text: 'followers note', visibility: 'followers' })).createdNote;
		(await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'followers' })).createdNote;
		await sleep();
		test('followers', async () => {
			const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		(await alice.client.request('notes/create', { text: 'specified note', visibility: 'specified', visibleUserIds: [bobInAliceHost.id] })).createdNote;
		(await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'specified', visibleUserIds: [bobInAliceHost.id] })).createdNote;
		await sleep();
		test('specified', async () => {
			const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
	});
	test('isQuarantineLimit false', async () => {
		await aAdmin.client.request('admin/federation/update-instance', { host: 'a.test', isQuarantineLimit: false });

		const carolPublicNote: Misskey.entities.Note = (await carol.client.request('notes/create', { text: 'I am Carol!' })).createdNote;
		const carolPublicRenote: Misskey.entities.Note = (await carol.client.request('notes/create', { renoteId: carolPublicNote.id })).createdNote;
		const expected :{text:string|null, createdAt:string}[] = [];
		expected.push({
			text: carolPublicNote.text,
			createdAt: carolPublicNote.createdAt,
		});
		expected.push({
			text: carolPublicRenote.text,
			createdAt: carolPublicRenote.createdAt,
		});
		await sleep();
		test('public', async () => {
			const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		const carolHomeNote: Misskey.entities.Note = (await carol.client.request('notes/create', { text: 'home note', visibility: 'home' })).createdNote;
		const carolHomeRenote: Misskey.entities.Note = (await carol.client.request('notes/create', { renoteId: carolPublicNote.id, visibility: 'home' })).createdNote;
		expected.push({
			text: carolHomeNote.text,
			createdAt: carolHomeNote.createdAt,
		});
		expected.push({
			text: carolHomeRenote.text,
			createdAt: carolHomeRenote.createdAt,
		});
		await sleep();
		test('home', async () => {
			const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		const carolFollowersNote: Misskey.entities.Note = (await carol.client.request('notes/create', { text: 'followers note', visibility: 'followers' })).createdNote;
		const carolFollowersRenote: Misskey.entities.Note = (await carol.client.request('notes/create', { renoteId: carolPublicNote.id, visibility: 'followers' })).createdNote;
		expected.push({
			text: carolFollowersNote.text,
			createdAt: carolFollowersNote.createdAt,
		});
		expected.push({
			text: carolFollowersRenote.text,
			createdAt: carolFollowersRenote.createdAt,
		});
		await sleep();
		test('followers', async () => {
			const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		const carolSpecifiedNote: Misskey.entities.Note = (await carol.client.request('notes/create', { text: 'specified note', visibility: 'specified', visibleUserIds: [bobInAliceHost.id] })).createdNote;
		const carolSpecifiedRenote: Misskey.entities.Note = (await carol.client.request('notes/create', { renoteId: carolPublicNote.id, visibility: 'specified', visibleUserIds: [bobInAliceHost.id] })).createdNote;
		expected.push({
			text: carolSpecifiedNote.text,
			createdAt: carolSpecifiedNote.createdAt,
		});
		expected.push({
			text: carolSpecifiedRenote.text,
			createdAt: carolSpecifiedRenote.createdAt,
		});
		await sleep();
		test('followers', async () => {
			const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
	});
});
