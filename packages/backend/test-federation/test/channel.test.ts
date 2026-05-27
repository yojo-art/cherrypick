import assert, { rejects, strictEqual } from 'node:assert';
import * as Misskey from 'misskey-js';
import { createAccount, type LoginUser, randomUsername, resolveRemoteNote, resolveRemoteUser, sleep } from './utils.js';

describe('Channel', () => {
	let alice: LoginUser, bob: LoginUser;
	let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe, aliceChActorInB: Misskey.entities.UserDetailedNotMe;
	let aliceCh: Misskey.entities.Channel, aliceChInB: Misskey.entities.Channel;

	beforeAll(async () => {
		[alice, bob] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
		]);
		aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert.ok(aliceCh.actorId, 'チャンネルアカウントが作成されそのidが入る');

		[bobInA, aliceInB, aliceChActorInB] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('a.test', alice.id, bob),
			resolveRemoteUser('a.test', aliceCh.actorId, bob),
		]);
		assert.ok(aliceChActorInB.channelId);
		aliceChInB = await bob.client.request('channels/show', { channelId: aliceChActorInB.channelId });
		strictEqual(aliceChActorInB.id, aliceChInB.actorId, 'チャンネルアカウントを照会するとローカルにチャンネルが作成される');
	});

	describe('Actor', () => {
		test('チャンネル名が連合する', async () => {
			strictEqual(aliceChActorInB.username, aliceCh.name, 'デフォルトはusername==name');
			assert.ok(aliceChActorInB.channelId);
			await alice.client.request('channels/update', { channelId: aliceCh.id, name: 'test Channel' });
			await sleep();
			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.name, 'test Channel');
			assert.ok(aliceCh.actorId);
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
			assert.ok(aliceChActorInB.channelId);
			await alice.client.request('channels/update', { channelId: aliceCh.id, description: 'Channel Description' });
			await sleep();
			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.description, 'Channel Description');
			assert.ok(aliceCh.actorId);
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
	describe('Note', () => {
		test('パブリックなチャンネル投稿がパブリックなチャンネル投稿として照会できる', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;

			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(aliceInB.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceChInB.id);
		});
	});
});
