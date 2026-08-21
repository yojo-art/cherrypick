import assert, { strictEqual, notStrictEqual } from 'node:assert';
import { describe, test } from 'vitest';
import { createAccount, randomUsername, waitForFederationTestNote, deliverFederationTestNote } from './utils.js';

describe('Channel Mention', () => {
	test('通常ノートでcc指定されたチャンネルアカウントに投稿される', async () => {
		const alice = await createAccount('a.test');
		const aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId);
		await deliverFederationTestNote('a.test', 'channel-mention/01-note-cc-only', {
			placeholders: { channelActor: aliceCh.actorId },
		});
		const note = await waitForFederationTestNote(alice, 'channel-mention/01-note-cc-only');
		strictEqual(note.channelId, aliceCh.id, 'cc指定されたチャンネルアカウントに投稿される');
	});

	test('通常ノートでメンションされたチャンネルアカウントに投稿される', async () => {
		const alice = await createAccount('a.test');
		const aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId);
		await deliverFederationTestNote('a.test', 'channel-mention/02-note', {
			placeholders: { channelActor: aliceCh.actorId },
		});
		const note = await waitForFederationTestNote(alice, 'channel-mention/02-note');
		strictEqual(note.channelId, aliceCh.id, 'メンションされたチャンネルアカウントに投稿される');
	});

	test('リノートでccに含まれたチャンネルアカウントに投稿される', async () => {
		const alice = await createAccount('a.test');
		const aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId);

		// リノート元を配送
		await deliverFederationTestNote('a.test', 'channel-mention/03-original');
		await waitForFederationTestNote(alice, 'channel-mention/03-original');

		// Announce を配送
		await deliverFederationTestNote('a.test', 'channel-mention/04-announce', {
			placeholders: { channelActor: aliceCh.actorId },
		});

		const renote = await waitForFederationTestNote(alice, 'channel-mention/04-announce');
		strictEqual(renote.channelId, aliceCh.id, 'ccに含まれたチャンネルアカウントにリノートされる');
		notStrictEqual(renote.renoteId, null);
	});

	test('通常ノートでccが指定されていないノートがチャンネルアカウントに投稿される', async () => {
		const alice = await createAccount('a.test');
		const aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId);
		await deliverFederationTestNote('a.test', 'channel-mention/05-note-without-cc', {
			placeholders: { channelActor: aliceCh.actorId },
		});
		const note = await waitForFederationTestNote(alice, 'channel-mention/05-note-without-cc');
		strictEqual(note.channelId, aliceCh.id, '通常ノートでccが指定されていないノートがチャンネルアカウントに投稿される');
	});

	test('通常ノートでaudienceのみ指定されているノートがチャンネルアカウントに投稿される', async () => {
		const alice = await createAccount('a.test');
		const aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId);
		await deliverFederationTestNote('a.test', 'channel-mention/06-note-audience-only', {
			placeholders: { channelActor: aliceCh.actorId },
		});
		const note = await waitForFederationTestNote(alice, 'channel-mention/06-note-audience-only');
		strictEqual(note.channelId, aliceCh.id, '通常ノートでaudienceのみ指定されているノートがチャンネルアカウントに投稿される');
	});
	test('リノートでaudienceに含まれたチャンネルアカウントに投稿される', async () => {
		const alice = await createAccount('a.test');
		const aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId);

		// リノート元を配送
		await deliverFederationTestNote('a.test', 'channel-mention/07-original');
		const note = await waitForFederationTestNote(alice, 'channel-mention/07-original');

		// Announce を配送
		await deliverFederationTestNote('a.test', 'channel-mention/08-announce-audience', {
			placeholders: { channelActor: aliceCh.actorId },
		});

		const renote = await waitForFederationTestNote(alice, 'channel-mention/08-announce-audience');
		strictEqual(renote.channelId, aliceCh.id, 'audienceに含まれたチャンネルアカウントにリノートされる');
		strictEqual(renote.renoteId, note.id);
	});
});
