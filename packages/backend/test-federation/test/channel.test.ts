import assert, { rejects, strictEqual } from 'node:assert';
import * as Misskey from 'misskey-js';
import { createAccount, type LoginUser, randomUsername, resolveRemoteNote, resolveRemoteUser, sleep } from './utils.js';

describe('Channel', () => {
	let alice: LoginUser, bob: LoginUser, carol: LoginUser;
	let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe, carolInB: Misskey.entities.UserDetailedNotMe;
	let aliceChActorInB: Misskey.entities.UserDetailedNotMe, aliceChActorInC: Misskey.entities.UserDetailedNotMe;
	let aliceCh: Misskey.entities.Channel, aliceChInB: Misskey.entities.Channel, aliceChInC: Misskey.entities.Channel;

	beforeAll(async () => {
		[alice, bob, carol] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
			createAccount('c.test'),
		]);
		aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId, 'チャンネルアカウントが作成されそのidが入る');

		[bobInA, aliceInB, carolInB, aliceChActorInB, aliceChActorInC] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('a.test', alice.id, bob),
			resolveRemoteUser('c.test', carol.id, bob),
			resolveRemoteUser('a.test', aliceCh.actorId, bob),
			resolveRemoteUser('a.test', aliceCh.actorId, carol),
		]);
		assert(aliceChActorInB.channelId);
		assert(aliceChActorInC.channelId);
		aliceChInB = await bob.client.request('channels/show', { channelId: aliceChActorInB.channelId });
		strictEqual(aliceChActorInB.id, aliceChInB.actorId, 'チャンネルアカウントを照会するとローカルにチャンネルが作成される');
		aliceChInC = await bob.client.request('channels/show', { channelId: aliceChActorInC.channelId });
	});

	describe('Actor', () => {
		test('チャンネル名が連合する', async () => {
			strictEqual(aliceChActorInB.username, aliceCh.name, 'デフォルトはusername==name');
			assert(aliceChActorInB.channelId);
			await alice.client.request('channels/update', { channelId: aliceCh.id, name: 'test Channel' });
			await sleep();
			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.name, 'test Channel');
			assert(aliceCh.actorId);
			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			strictEqual(channelActorInA.name, aliceCh.name);
			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep(2000);

			const channelActorInB = await bob.client.request('users/show', { userId: aliceChActorInB.id });
			strictEqual(channelActorInB.name, aliceCh.name);
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(aliceChInB.name, aliceCh.name);
		});
		test('チャンネル説明文が連合する', async () => {
			assert(aliceChActorInB.channelId);
			await alice.client.request('channels/update', { channelId: aliceCh.id, description: 'Channel Description' });
			await sleep();
			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.description, 'Channel Description');
			assert(aliceCh.actorId);
			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			strictEqual(channelActorInA.description, aliceCh.description);
			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep(2000);

			const channelActorInB = await bob.client.request('users/show', { userId: aliceChActorInB.id });
			strictEqual(channelActorInB.description, aliceCh.description);
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(aliceChInB.description, aliceCh.description);
		});
	});
	describe('Fetch Note', () => {
		test('パブリックなチャンネル投稿がパブリックなチャンネル投稿として照会できる', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;

			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(aliceInB.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceChInB.id);
			strictEqual(resolvedNote.visibility, 'public');
		});
		test('ホームなチャンネル投稿がホームなチャンネル投稿として照会できる', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'home',
			})).createdNote;

			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(aliceInB.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceChInB.id);
			strictEqual(resolvedNote.visibility, 'home');
		});
		test('チャンネル管理、閲覧、投稿がすべて別インスタンスでも動く', async () => {
			const note = (await carol.client.request('notes/create', {
				text: 'I am Carol!',
				channelId: aliceChInC.id,
				visibility: 'public',
			})).createdNote;

			const resolvedNote = await resolveRemoteNote('c.test', note.id, bob);
			strictEqual(carolInB.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceChInB.id);
			strictEqual(resolvedNote.visibility, 'public');
		});
	});
	describe('Timeline', () => {
		beforeAll(async () => {
			await bob.client.request('following/create', { userId: aliceInB.id });
		});
		test('ユーザーをフォローしてもHTLにチャンネル投稿は流れてこない', async () => {
			const channelNoteInA = (await alice.client.request('notes/create', {
				text: randomUsername(),
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;
			const normalNoteInA = (await alice.client.request('notes/create', {
				text: randomUsername(),
				visibility: 'public',
			})).createdNote;
			await sleep();
			const bobHTL = await bob.client.request('notes/timeline', {});

			assert(!bobHTL.map(note => note.text).includes(channelNoteInA.text));
			assert(bobHTL.map(note => note.text).includes(normalNoteInA.text));
		});
		test('チャンネルをフォローするとチャンネル投稿も流れてくる', async () => {
			await bob.client.request('channels/follow', {
				channelId: aliceChInB.id,
				visibility: 'public',
			});
			assert(aliceChInB.actorId);
			const channelActorInB = await bob.client.request('users/show', { userId: aliceChInB.actorId });
			assert(channelActorInB.isFollowing, 'チャンネルをフォローするとチャンネルアカウントがフォローされる');
			const normalNoteInA = (await alice.client.request('notes/create', {
				text: randomUsername(),
				visibility: 'public',
			})).createdNote;
			const channelNoteInC = (await carol.client.request('notes/create', {
				text: randomUsername(),
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;
			const normalNoteInC = (await carol.client.request('notes/create', {
				text: randomUsername(),
				visibility: 'public',
			})).createdNote;
			const bobHTL = await bob.client.request('notes/timeline', {});

			assert(bobHTL.map(note => note.text).includes(normalNoteInA.text), 'aliceをフォローしているのでHTLに流れてくる');
			assert(bobHTL.map(note => note.text).includes(channelNoteInC.text), 'aliceChをフォローしているのでHTLに流れてくる');
			assert(!bobHTL.map(note => note.text).includes(normalNoteInC.text), 'carolをフォローしていないのでHTLに流れてこない');
			strictEqual(bobHTL.filter(note => note.user.channelId != null), 0, 'チャンネルアカウントの投稿はHTLに流れてこない');
		});
	});
});
