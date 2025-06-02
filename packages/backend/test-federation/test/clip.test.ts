import assert, { rejects, strictEqual } from 'node:assert';
import * as Misskey from 'cherrypick-js';
import { createAccount, deepStrictEqualWithExcludedFields, fetchAdmin, type LoginUser, resolveRemoteNote, resolveRemoteUser, sleep } from './utils.js';

describe('Clips', () => {
	let alice: LoginUser, bob: LoginUser;
	let aliceInB: Misskey.entities.UserDetailedNotMe, bobInA: Misskey.entities.UserDetailedNotMe;

	beforeAll(async () => {
		[alice, bob] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
		]);
		aliceInB = await resolveRemoteUser('a.test', alice.id, bob);
		bobInA = await resolveRemoteUser('b.test', bob.id, alice);
	});
	const clearAllClips = async () => {
		const aliceClips = await alice.client.request('clips/list', {});
		for (const aliceClip of aliceClips) {
			//関係ないクリップは消しておく
			await alice.client.request('clips/delete', { clipId: aliceClip.id });
		}
	};
	test('公開クリップ公開ノートが連合する', async () => {
		await clearAllClips();
		const public_note = (await alice.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
		const home_note = (await alice.client.request('notes/create', { text: 'home note' + crypto.randomUUID().replaceAll('-', ''), visibility: 'home' })).createdNote;
		const new_clip = await alice.client.request('clips/create', { name: '公開クリップ公開ノートが連合する', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
		await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: public_note.id });
		await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: home_note.id });

		//lastClippedAtを更新するために一覧から取得する
		const clip = (await alice.client.request('users/clips', { userId: alice.id, remoteApi: false }))[0];
		await sleep();

		await bob.client.request('users/show', { userId: aliceInB.id });
		await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
		await sleep();
		await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		await sleep();
		const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		strictEqual(aliceInBClips.length, 1);
		strictEqual(aliceInBClips[0].name, clip.name);
		strictEqual(aliceInBClips[0].description, clip.description);
		strictEqual(new Date(aliceInBClips[0].createdAt).getTime() - 1000 < new Date(clip.createdAt).getTime() + 1000, true);//多少の誤差が出る
		assert(aliceInBClips[0].lastClippedAt != null);
		assert(clip.lastClippedAt != null);
		strictEqual(new Date(aliceInBClips[0].lastClippedAt).getTime() - 1000 < new Date(clip.lastClippedAt).getTime() + 1000, true);//多少の誤差が出る
		strictEqual(aliceInBClips[0].userId, aliceInB.id);
		//非同期で取得されるから2回リクエスト飛ばす
		await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
		await sleep();
		const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
		strictEqual(notes.length, 2);
		strictEqual(notes[0].text, home_note.text);
		strictEqual(notes[1].text, public_note.text);
	});
	test('公開クリップ他人ノートが連合する', async () => {
		await clearAllClips();
		const bob_note = (await bob.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
		const clip = await alice.client.request('clips/create', { name: '公開クリップ他人ノートが連合する', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
		await sleep();
		const show_note = await alice.client.request('ap/show', { uri: `https://b.test/notes/${bob_note.id}` });
		await alice.client.request('clips/add-note', { clipId: clip.id, noteId: show_note.object.id });
		//ユーザー情報更新
		await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
		await sleep();
		await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		await sleep();
		const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		strictEqual(aliceInBClips.length, 1);
		strictEqual(aliceInBClips[0].name, clip.name);
		strictEqual(aliceInBClips[0].description, clip.description);
		//非同期で取得されるから2回リクエスト飛ばす
		await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
		await sleep();
		const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
		strictEqual(notes.length, 1);
		strictEqual(notes[0].text, bob_note.text);
	});
	test('公開クリップ限定ノートが連合しない', async () => {
		await clearAllClips();
		const followers_note = (await alice.client.request('notes/create', { text: 'followers note' + crypto.randomUUID().replaceAll('-', ''), visibility: 'followers' })).createdNote;
		await sleep();
		const clip = await alice.client.request('clips/create', { name: '公開クリップ限定ノートが連合しない', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
		await alice.client.request('clips/add-note', { clipId: clip.id, noteId: followers_note.id });
		//ユーザー情報更新
		await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
		await sleep();
		const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		//公開クリップがある
		strictEqual(aliceInBClips.length, 1);
		strictEqual(aliceInBClips[0].name, clip.name);
		strictEqual(aliceInBClips[0].description, clip.description);
		//非同期で取得されるから2回リクエスト飛ばす
		await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
		await sleep();
		const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
		//フォロワー限定ノートは見えない
		strictEqual(notes.length, 0);
	});
	test('公開クリップ限定ノートが連合する', async () => {
		await clearAllClips();
		await alice.client.request('following/create', { userId: bobInA.id });
		//フォロー処理待ち
		await sleep(800);
		const bob_note = (await bob.client.request('notes/create', { text: 'followers note' + crypto.randomUUID().replaceAll('-', ''), visibility: 'followers' })).createdNote;
		//ノート配送待ち
		await sleep();
		const user_notes = await alice.client.request('users/notes', { userId: bobInA.id });
		//フォロワーに配送来てるはず
		const bob_noteInA = user_notes[0];
		strictEqual(bob_noteInA.text, bob_note.text);
		const clip = await alice.client.request('clips/create', { name: '公開クリップ限定ノートが連合する', description: 'description', isPublic: true });
		await alice.client.request('clips/add-note', { clipId: clip.id, noteId: bob_noteInA.id });
		//ユーザー情報更新
		await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
		await sleep();
		const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		strictEqual(aliceInBClips[0].name, clip.name);
		strictEqual(aliceInBClips[0].description, clip.description);
		//非同期で取得されるから2回リクエスト飛ばす
		await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
		await sleep();
		const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
		strictEqual(notes.length, 1);
		strictEqual(notes[0].text, bob_note.text);
	});
	test('非公開クリップが連合しない', async () => {
		await clearAllClips();
		await alice.client.request('clips/create', { name: 'private', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: false });
		const clip = await alice.client.request('clips/create', { name: 'public', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
		//ユーザー情報更新
		await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
		await sleep();
		const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		//0件にするとリモートAPI呼び出しが発生してキャッシュ由来の変な値になる
		strictEqual(aliceInBClips.length, 1);
		strictEqual(aliceInBClips[0].name, clip.name);
		strictEqual(aliceInBClips[0].description, clip.description);
	});
	test('名前と説明文が更新できる', async () => {
		await clearAllClips();
		const clip = await alice.client.request('clips/create', { name: '更新前', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
		//ユーザー情報更新
		await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
		await sleep();
		const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		strictEqual(aliceInBClips.length, 1);
		strictEqual(aliceInBClips[0].name, clip.name);
		strictEqual(aliceInBClips[0].description, clip.description);
		const clip2 = await alice.client.request('clips/update', { clipId: clip.id, name: '更新後', description: 'description' + crypto.randomUUID().replaceAll('-', '') });
		//ユーザー情報更新
		await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
		await sleep();
		const aliceInBClips2 = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
		strictEqual(aliceInBClips2.length, 1);
		strictEqual(aliceInBClips2[0].name, clip2.name);
		strictEqual(aliceInBClips2[0].description, clip2.description);
	});
	describe('配送', () => {
		test('非公開クリップが連合しない', async () => {
			await bob.client.request('following/create', { userId: aliceInB.id });
			await sleep(800);
			await clearAllClips();
			const clip = await alice.client.request('clips/create', { name: 'public', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			const clip2 = await alice.client.request('clips/create', { name: 'private', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: false });
			await sleep(800);
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			//0件にするとリモートAPI呼び出しが発生してキャッシュ由来の変な値になる
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			const clip2u = await alice.client.request('clips/update', { clipId: clip2.id, isPublic: true });
			strictEqual(clip2u.isPublic, true);
			const aliceClips = await alice.client.request('users/clips', { userId: alice.id, remoteApi: false });
			strictEqual(aliceClips.length, 2);
			await sleep(800);
			const aliceInBClips2 = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips2.length, 2);
		});
		test('名前と説明文が更新できる', async () => {
			await clearAllClips();
			const clip = await alice.client.request('clips/create', { name: '更新前', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await sleep(800);
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			const clip2 = await alice.client.request('clips/update', { clipId: clip.id, name: '更新後', description: 'description' + crypto.randomUUID().replaceAll('-', '') });
			strictEqual(clip2.name, '更新後');
			strictEqual(clip2.isPublic, true);
			await sleep(800);
			const aliceInBClips2 = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips2.length, 1);
			strictEqual(aliceInBClips2[0].name, clip2.name);
			strictEqual(aliceInBClips2[0].description, clip2.description);
		});

		test('公開クリップ他人ノートが連合する', async () => {
			await clearAllClips();
			const bob_note = (await bob.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
			const clip = await alice.client.request('clips/create', { name: '公開クリップ他人ノートが連合する', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await sleep(800);
			const show_note = await alice.client.request('ap/show', { uri: `https://b.test/notes/${bob_note.id}` });
			await alice.client.request('clips/add-note', { clipId: clip.id, noteId: show_note.object.id });
			await sleep(800);
			await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			await sleep(800);
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			//非同期で取得されるから2回リクエスト飛ばす
			await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			await sleep(800);
			const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			strictEqual(notes.length, 1);
			strictEqual(notes[0].text, bob_note.text);
		});
		test('公開設定が更新できる', async () => {
			await clearAllClips();
			const clip = await alice.client.request('clips/create', { name: '更新前', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await sleep(800);
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			await alice.client.request('clips/update', { clipId: clip.id, name: '更新後', isPublic: false });
			await sleep(800);
			const aliceInBClips2 = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips2.length, 0);
			const clip3 = await alice.client.request('clips/update', { clipId: clip.id, isPublic: true, description: 'description' + crypto.randomUUID().replaceAll('-', '') });
			await sleep(800);
			const aliceInBClips3 = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips3.length, 1);
			strictEqual(aliceInBClips3[0].name, clip3.name);
			strictEqual(aliceInBClips3[0].description, clip3.description);
		});
	});
});
