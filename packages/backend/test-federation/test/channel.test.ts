import assert, { rejects, strictEqual } from 'node:assert';
import * as Misskey from 'misskey-js';
import { createAccount, deepStrictEqualWithExcludedFields, type LoginUser, resolveRemoteNote, resolveRemoteUser, createChannel, sleep } from './utils.js';

describe('Channel', () => {
	let alice: LoginUser, bob: LoginUser;
	let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe, aliceChActorInB: Misskey.entities.UserDetailedNotMe;
	let aliceCh: Misskey.entities.Channel, aliceChInB: Misskey.entities.Channel;

	beforeAll(async () => {
		[alice, bob, aliceCh] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
			createChannel('a.test'),
		]);
		assert.ok(aliceCh.actorId);

		[bobInA, aliceInB, aliceChActorInB] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('a.test', alice.id, bob),
			resolveRemoteUser('a.test', aliceCh.actorId, bob),
		]);
		assert.ok(aliceChActorInB.channelId);
		aliceChInB = await bob.client.request('channels/show', { channelId: aliceChActorInB.channelId });
	});

	describe('Actor', () => {
		test('チャンネル名が連合する', async () => {
			assert.ok(aliceChActorInB.channelId);
			await alice.client.request('channels/update', { channelId: aliceCh.id, name: 'test Channel' });
			await sleep();
			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.name, 'test Channel');

			const channelActor = await bob.client.request('users/show', { userId: aliceChActorInB.id });
			strictEqual(channelActor.name, aliceCh.name);
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(aliceChInB.name, aliceCh.name);
		});
		test('チャンネル説明文が連合する', async () => {
			assert.ok(aliceChActorInB.channelId);
			await alice.client.request('channels/update', { channelId: aliceCh.id, description: 'Channel Description' });
			await sleep();
			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.description, 'Channel Description');

			const channelActor = await bob.client.request('users/show', { userId: aliceChActorInB.id });
			strictEqual(channelActor.description, aliceCh.description);
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
