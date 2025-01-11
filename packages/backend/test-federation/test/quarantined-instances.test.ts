import assert, { deepStrictEqual, strictEqual } from 'node:assert';
import * as Misskey from 'cherrypick-js';
import { createAccount, fetchAdmin, type LoginUser, resolveRemoteNote, resolveRemoteUser, sleep } from './utils.js';

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
		await bob.client.request('following/create', { userId: carolInBobHost.id });
		aAdmin = await fetchAdmin('a.test');
		await sleep();
	});
	describe('isQuarantineLimit true', () => {
		let alicePublicNote: Misskey.entities.Note, alicePublicRenote: Misskey.entities.Note;
		const expected :{text:string|null, createdAt:string}[] = [];
		beforeAll(async () => {
			await aAdmin.client.request('admin/federation/update-instance', { host: 'b.test', isQuarantineLimit: true });
			await sleep();
			strictEqual((await aAdmin.client.request('federation/show-instance', { host: 'b.test' }))?.isQuarantineLimited, true);
			alicePublicNote = (await alice.client.request('notes/create', { text: 'I am Alice!' })).createdNote;
			alicePublicRenote = (await alice.client.request('notes/create', { renoteId: alicePublicNote.id })).createdNote;
			expected.push({
				text: alicePublicNote.text,
				createdAt: alicePublicNote.createdAt,
			});
			expected.push({
				text: alicePublicRenote.text,
				createdAt: alicePublicRenote.createdAt,
			});
		});
		test('public', async () => {
			await sleep();
			const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		test('home', async () => {
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
			const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		test('followers', async () => {
			(await alice.client.request('notes/create', { text: 'followers note', visibility: 'followers' })).createdNote;
			(await alice.client.request('notes/create', { renoteId: alicePublicNote.id, visibility: 'followers' })).createdNote;
			await sleep();
			const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		test('specified', async () => {
			(await alice.client.request('notes/create', { text: 'specified note', visibility: 'specified', visibleUserIds: [bobInAliceHost.id] })).createdNote;
			await sleep();
			const fetch_notes = await bob.client.request('users/notes', { userId: aliceInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		test('block', async () => {
			await alice.client.request('blocking/create', { userId: bobInAliceHost.id });
			await sleep();
			const resolvedNote = await resolveRemoteNote('a.test', alicePublicNote.id, bob);
			//ブロックの配送が来ないのでb.testではブロックされていないように見える
			await bob.client.request('notes/reactions/create', { noteId: resolvedNote.id, reaction: '😅' });
			//実際にはブロックしているのでリアクションが追加されない
			const note = await alice.client.request('notes/show', { noteId: alicePublicNote.id });
			strictEqual(Object.values(note.reactions).length, 0);
		});
	});
	describe('isQuarantineLimit false', () => {
		let carolPublicNote: Misskey.entities.Note, carolPublicRenote: Misskey.entities.Note;
		const expected :{text:string|null, createdAt:string}[] = [];
		beforeAll(async () => {
			await aAdmin.client.request('admin/federation/update-instance', { host: 'b.test', isQuarantineLimit: false });
			await sleep();
			strictEqual((await aAdmin.client.request('federation/show-instance', { host: 'b.test' }))?.isQuarantineLimited, false);
			carolPublicNote = (await carol.client.request('notes/create', { text: 'I am Carol!' })).createdNote;
			carolPublicRenote = (await carol.client.request('notes/create', { renoteId: carolPublicNote.id })).createdNote;

			expected.push({
				text: carolPublicNote.text,
				createdAt: carolPublicNote.createdAt,
			});
			expected.push({
				text: carolPublicRenote.text,
				createdAt: carolPublicRenote.createdAt,
			});
		});
		test('public', async () => {
			await sleep();
			const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		test('home', async () => {
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
			const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		test('followers', async () => {
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
			const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		test('specified', async () => {
			const carolSpecifiedNote: Misskey.entities.Note = (await carol.client.request('notes/create', { text: 'specified note', visibility: 'specified', visibleUserIds: [bobInAliceHost.id] })).createdNote;
			expected.push({
				text: carolSpecifiedNote.text,
				createdAt: carolSpecifiedNote.createdAt,
			});
			await sleep();
			const fetch_notes = await bob.client.request('users/notes', { userId: carolInBobHost.id, withReplies: false, withRenotes: true });
			strictEqual(fetch_notes.length, expected.length, JSON.stringify(fetch_notes));
			deepStrictEqual(JSON.stringify(fetch_notes.map(note => {
				return {
					text: note.text,
					createdAt: note.createdAt,
				};
			})), JSON.stringify(Array.from(expected).reverse()));
		});
		//FIXME: assert.rejectsがundefinedを返す
		test.skip('block', async () => {
			await carol.client.request('blocking/create', { userId: bobInAliceHost.id });
			await sleep();
			const resolvedNote = await resolveRemoteNote('a.test', carolPublicNote.id, bob);
			await assert.rejects(
				async () => await bob.client.request('notes/reactions/create', { noteId: resolvedNote.id, reaction: '😅' }),
				(err: any) => {
					strictEqual(err.code, 'YOU_HAVE_BEEN_BLOCKED');
					return true;
				},
			);
			//ブロックしているのでリアクションが追加されない
			const note = await alice.client.request('notes/show', { noteId: carolPublicNote.id });
			strictEqual(Object.values(note.reactions).length, 0);
		});
	});
});
