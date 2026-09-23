/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * チャット連合の通常系テスト。
 *
 * a.test / b.test / c.test のフル Misskey インスタンス間で、DM と room の
 * 正常な連合経路 (Create / Invite / Accept / Remove / Reject / Undo) が
 * 機能することを検証する。
 *
 */

import { beforeAll, describe, expect, test } from 'vitest';
import * as Misskey from 'misskey-js';
import { assertNotificationReceived, createAccount, resolveRemoteUser, sleep, uploadFile, waitFor, type LoginUser } from './utils.js';

/** 連合の反映を待つ最大時間 */
const FED_TIMEOUT = 30_000;
/** 配送されないことを観測する時間 (inbox job の初回リトライより短く取る) */
const ABSENCE_WAIT = 15_000;

const nonce = () => crypto.randomUUID().replaceAll('-', '').slice(0, 12);

type RemoteUser = Misskey.entities.UserDetailedNotMe;

type ChatMessageLite = {
	id: string;
	text?: string | null;
	fromUserId: string;
	toUserId?: string | null;
	toRoomId?: string | null;
	file?: Misskey.entities.DriveFile | null;
};

type ChatRoomInvitation = {
	id: string;
	roomId: string;
	userId: string;
	room?: { id: string } | null;
};

type ChatRoomMembership = {
	id: string;
	roomId: string;
	userId: string;
	user?: { id: string } | null;
};

async function requestChat<T>(user: LoginUser, endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return await user.client.request(endpoint as any, params as any) as T;
}

async function ensureMutualFollow(follower: LoginUser, followeeOnFollower: RemoteUser, followee: LoginUser, followerOnFollowee: RemoteUser): Promise<void> {
	await Promise.all([
		follower.client.request('following/create', { userId: followeeOnFollower.id }),
		followee.client.request('following/create', { userId: followerOnFollowee.id }),
	]);

	await waitFor(async () => {
		const [relationOnFollower, relationOnFollowee] = await Promise.all([
			follower.client.request('users/relation', { userId: followeeOnFollower.id }),
			followee.client.request('users/relation', { userId: followerOnFollowee.id }),
		]);
		// userId 指定時も実行時は配列で返る (型定義と異なる)
		const followerRelation = Array.isArray(relationOnFollower) ? relationOnFollower[0] : relationOnFollower;
		const followeeRelation = Array.isArray(relationOnFollowee) ? relationOnFollowee[0] : relationOnFollowee;
		return followerRelation.isFollowing && followerRelation.isFollowed
			&& followeeRelation.isFollowing && followeeRelation.isFollowed;
	}, { timeout: FED_TIMEOUT, interval: 1_000 });
}

async function fetchDmTimeline(user: LoginUser, otherId: string): Promise<ChatMessageLite[]> {
	return await requestChat(user, 'chat/messages/user-timeline', { userId: otherId, limit: 50 });
}

async function waitForDm(user: LoginUser, otherId: string, match: (message: ChatMessageLite) => boolean, timeout = FED_TIMEOUT): Promise<ChatMessageLite> {
	let found: ChatMessageLite | undefined;
	await waitFor(async () => {
		found = (await fetchDmTimeline(user, otherId)).find(match);
		return found != null;
	}, { timeout, interval: 1_000 });
	if (found == null) throw new Error('unreachable: waitFor should have thrown');
	return found;
}

async function fetchRoomTimeline(user: LoginUser, roomId: string): Promise<ChatMessageLite[]> {
	return await requestChat(user, 'chat/messages/room-timeline', { roomId, limit: 50 });
}

async function waitForRoomMessage(user: LoginUser, roomId: string, match: (message: ChatMessageLite) => boolean, timeout = FED_TIMEOUT): Promise<ChatMessageLite> {
	let found: ChatMessageLite | undefined;
	await waitFor(async () => {
		found = (await fetchRoomTimeline(user, roomId)).find(match);
		return found != null;
	}, { timeout, interval: 1_000 });
	if (found == null) throw new Error('unreachable: waitFor should have thrown');
	return found;
}

async function fetchMembers(user: LoginUser, roomId: string): Promise<ChatRoomMembership[]> {
	return await requestChat(user, 'chat/rooms/members', { roomId, limit: 100 });
}

async function isRoomMember(user: LoginUser, roomId: string, userId: string): Promise<boolean> {
	try {
		return (await fetchMembers(user, roomId)).some(m => m.userId === userId);
	} catch {
		return false;
	}
}

async function fetchInvitationInbox(user: LoginUser): Promise<ChatRoomInvitation[]> {
	return await requestChat(user, 'chat/rooms/invitations/inbox', { limit: 100 });
}

async function hasInboxInvitation(user: LoginUser, roomId: string): Promise<boolean> {
	try {
		return (await fetchInvitationInbox(user)).some(i => i.roomId === roomId);
	} catch {
		return false;
	}
}

async function fetchInvitationOutbox(user: LoginUser, roomId: string): Promise<ChatRoomInvitation[]> {
	return await requestChat(user, 'chat/rooms/invitations/outbox', { roomId, limit: 100 });
}

async function hasOutboxInvitation(user: LoginUser, roomId: string): Promise<boolean> {
	try {
		return (await fetchInvitationOutbox(user, roomId)).length > 0;
	} catch {
		return false;
	}
}

async function fetchJoiningRooms(user: LoginUser): Promise<{ id: string }[]> {
	return await requestChat(user, 'chat/rooms/joining', { limit: 100 });
}

/** 連合経由で配送されないことを確認する */
async function expectNotDelivered(probe: () => Promise<boolean>, label: string): Promise<void> {
	await sleep(ABSENCE_WAIT);
	expect(await probe(), `${label}: 配送されてはいけないものが配送された`).toBe(false);
}

// ─────────────────────────────────────────────────────────────
// DM (1:1)
// ─────────────────────────────────────────────────────────────
describe('chat federation: 1:1 DM', () => {
	let alice: LoginUser;
	let bob: LoginUser;
	let bobInA: RemoteUser;
	let aliceInB: RemoteUser;

	beforeAll(async () => {
		[alice, bob] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
		]);
		[bobInA, aliceInB] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('a.test', alice.id, bob),
		]);
		await ensureMutualFollow(alice, bobInA, bob, aliceInB);
	}, 1000 * 60 * 3);

	test('a → b の DM が b の user-timeline に届く', async () => {
		const text = `chat-fed-dm-a2b-${nonce()}`;
		await requestChat(alice, 'chat/messages/create-to-user', { toUserId: bobInA.id, text });

		const received = await waitForDm(bob, aliceInB.id, m => m.text === text);
		expect(received.text).toBe(text);
		expect(received.fromUserId).toBe(aliceInB.id);
		expect(received.toUserId).toBe(bob.id);
	}, 1000 * 60);

	test('b → a の DM が a の user-timeline に届く', async () => {
		const text = `chat-fed-dm-b2a-${nonce()}`;
		await requestChat(bob, 'chat/messages/create-to-user', { toUserId: aliceInB.id, text });

		const received = await waitForDm(alice, bobInA.id, m => m.text === text);
		expect(received.text).toBe(text);
		expect(received.fromUserId).toBe(bobInA.id);
		expect(received.toUserId).toBe(alice.id);
	}, 1000 * 60);

	test('添付付き DM が file 付きで届く', async () => {
		const text = `chat-fed-dm-file-${nonce()}`;
		const file = await uploadFile('a.test', alice);
		await requestChat(alice, 'chat/messages/create-to-user', { toUserId: bobInA.id, text, fileId: file.id });

		const received = await waitForDm(bob, aliceInB.id, m => m.text === text);
		expect(received.file).toBeTruthy();
		// リモートファイルは受信側インスタンスの URL に置き換わる
		expect(received.file?.url ?? '').not.toBe('');
	}, 1000 * 60);
});

// ─────────────────────────────────────────────────────────────
// DM の認可 (否定系)
// ─────────────────────────────────────────────────────────────
describe('chat federation: 1:1 DM authorization', () => {
	let alice: LoginUser;
	let bob: LoginUser;
	let carol: LoginUser;
	let bobInA: RemoteUser;
	let carolInA: RemoteUser;
	let aliceInB: RemoteUser;

	beforeAll(async () => {
		[alice, bob, carol] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
			createAccount('b.test'),
		]);
		[bobInA, carolInA, aliceInB] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('b.test', carol.id, alice),
			resolveRemoteUser('a.test', alice.id, bob),
		]);
		await ensureMutualFollow(alice, bobInA, bob, aliceInB);
	}, 1000 * 60 * 3);

	test('相互フォローでない相手への DM は送信側で拒否される', async () => {
		const text = `chat-fed-dm-nofollow-${nonce()}`;
		await expect(
			requestChat(alice, 'chat/messages/create-to-user', { toUserId: carolInA.id, text }),
		).rejects.toThrow();
	}, 1000 * 60);

	test('受信側 chatScope=none の相手には連合配送されない', async () => {
		await bob.client.request('i/update', { chatScope: 'none' });

		const text = `chat-fed-dm-scope-${nonce()}`;
		// 送信側は受信者の chatScope を知らないため API は成功する
		await requestChat(alice, 'chat/messages/create-to-user', { toUserId: bobInA.id, text });
		await waitForDm(alice, bobInA.id, m => m.text === text);

		await expectNotDelivered(
			async () => (await fetchDmTimeline(bob, aliceInB.id)).some(m => m.text === text),
			'chatScope=none の受信者への DM',
		);
	}, 1000 * 60);

	test('受信側がブロックしている送信者からの DM は配送されない', async () => {
		await bob.client.request('blocking/create', { userId: aliceInB.id });

		const text = `chat-fed-dm-blocked-${nonce()}`;
		// 送信側の時点で拒否される場合もあるため、結果は問わず受信側での不在のみ確認する
		await requestChat(alice, 'chat/messages/create-to-user', { toUserId: bobInA.id, text }).catch(() => undefined);

		await expectNotDelivered(
			async () => (await fetchDmTimeline(bob, aliceInB.id)).some(m => m.text === text),
			'ブロック中ユーザーからの DM',
		);
	}, 1000 * 60);
});

// ─────────────────────────────────────────────────────────────
// room (owner=a / members=b, c)
// ─────────────────────────────────────────────────────────────
describe('chat federation: chat room', () => {
	let alice: LoginUser;
	let bob: LoginUser;
	let carol: LoginUser;
	let bobInA: RemoteUser;
	let carolInA: RemoteUser;
	let aliceInB: RemoteUser;
	let aliceInC: RemoteUser;
	let roomId: string;

	beforeAll(async () => {
		[alice, bob, carol] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
			createAccount('c.test'),
		]);
		[bobInA, carolInA, aliceInB, aliceInC] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('c.test', carol.id, alice),
			resolveRemoteUser('a.test', alice.id, bob),
			resolveRemoteUser('a.test', alice.id, carol),
		]);

		const room = await requestChat<{ id: string }>(alice, 'chat/rooms/create', { name: `chat-fed-room-${nonce()}` });
		roomId = room.id;
	}, 1000 * 60 * 3);

	test('room 招待が通知と invitations/inbox に反映される', async () => {
		await assertNotificationReceived(
			'b.test', bob,
			() => requestChat(alice, 'chat/rooms/invitations/create', { roomId, userId: bobInA.id }),
			notification => notification.type === 'chatRoomInvitationReceived',
			true,
		);
		await waitFor(() => hasInboxInvitation(bob, roomId), { timeout: FED_TIMEOUT, interval: 1_000 });
	}, 1000 * 60);

	test('b が join すると owner 側の members に反映される', async () => {
		await requestChat(bob, 'chat/rooms/join', { roomId });
		await waitFor(() => isRoomMember(alice, roomId, bobInA.id), { timeout: FED_TIMEOUT, interval: 1_000 });
		expect(await hasInboxInvitation(bob, roomId)).toBe(false);
	}, 1000 * 60);

	test('c への招待と join も owner 側の members に反映される', async () => {
		await requestChat(alice, 'chat/rooms/invitations/create', { roomId, userId: carolInA.id });
		await waitFor(() => hasInboxInvitation(carol, roomId), { timeout: FED_TIMEOUT, interval: 1_000 });

		await requestChat(carol, 'chat/rooms/join', { roomId });
		await waitFor(() => isRoomMember(alice, roomId, carolInA.id), { timeout: FED_TIMEOUT, interval: 1_000 });
		expect(aliceInC.id).toBeTruthy();
		expect(aliceInB.id).toBeTruthy();
	}, 1000 * 60);

	test('owner の発言が b / c に fan-out される', async () => {
		const text = `chat-fed-room-a-${nonce()}`;
		await requestChat(alice, 'chat/messages/create-to-room', { toRoomId: roomId, text });

		const [receivedByB, receivedByC] = await Promise.all([
			waitForRoomMessage(bob, roomId, m => m.text === text),
			waitForRoomMessage(carol, roomId, m => m.text === text),
		]);
		expect(receivedByB.fromUserId).toBe(aliceInB.id);
		expect(receivedByC.fromUserId).toBe(aliceInC.id);
	}, 1000 * 60);

	test('member の発言が owner に届く', async () => {
		const text = `chat-fed-room-b-${nonce()}`;
		await requestChat(bob, 'chat/messages/create-to-room', { toRoomId: roomId, text });

		const receivedByA = await waitForRoomMessage(alice, roomId, m => m.text === text);
		expect(receivedByA.fromUserId).toBe(bobInA.id);
	}, 1000 * 60);

	test('添付付き room 発言が file 付きで届く', async () => {
		const text = `chat-fed-room-file-${nonce()}`;
		const file = await uploadFile('a.test', alice);
		await requestChat(alice, 'chat/messages/create-to-room', { toRoomId: roomId, text, fileId: file.id });

		const received = await waitForRoomMessage(bob, roomId, m => m.text === text);
		expect(received.file).toBeTruthy();
		// リモートファイルは受信側インスタンスの URL に置き換わる
		expect(received.file?.url ?? '').not.toBe('');
	}, 1000 * 60);

	test('招待を reject すると owner の invitations/outbox から消える', async () => {
		const room = await requestChat<{ id: string }>(alice, 'chat/rooms/create', { name: `chat-fed-reject-${nonce()}` });
		await requestChat(alice, 'chat/rooms/invitations/create', { roomId: room.id, userId: bobInA.id });
		await waitFor(() => hasInboxInvitation(bob, room.id), { timeout: FED_TIMEOUT, interval: 1_000 });
		expect(await hasOutboxInvitation(alice, room.id)).toBe(true);

		await requestChat(bob, 'chat/rooms/invitations/reject', { roomId: room.id });
		await waitFor(() => hasOutboxInvitation(alice, room.id).then(v => !v), { timeout: FED_TIMEOUT, interval: 1_000 });
		expect(await hasInboxInvitation(bob, room.id)).toBe(false);
	}, 1000 * 60);

	test('招待を cancel (Undo) すると invitee の inbox から消える', async () => {
		const room = await requestChat<{ id: string }>(alice, 'chat/rooms/create', { name: `chat-fed-cancel-${nonce()}` });
		const invitation = await requestChat<ChatRoomInvitation>(alice, 'chat/rooms/invitations/create', { roomId: room.id, userId: bobInA.id });
		await waitFor(() => hasInboxInvitation(bob, room.id), { timeout: FED_TIMEOUT, interval: 1_000 });

		await requestChat(alice, 'chat/rooms/invitations/cancel', { invitationId: invitation.id });
		await waitFor(() => hasInboxInvitation(bob, room.id).then(v => !v), { timeout: FED_TIMEOUT, interval: 1_000 });
	}, 1000 * 60);

	test('招待のみで未 join のユーザーは room に発言できない', async () => {
		const room = await requestChat<{ id: string }>(alice, 'chat/rooms/create', { name: `chat-fed-unjoined-${nonce()}` });
		await requestChat(alice, 'chat/rooms/invitations/create', { roomId: room.id, userId: carolInA.id });
		await waitFor(() => hasInboxInvitation(carol, room.id), { timeout: FED_TIMEOUT, interval: 1_000 });

		await expect(
			requestChat(carol, 'chat/messages/create-to-room', { toRoomId: room.id, text: `chat-fed-unjoined-msg-${nonce()}` }),
		).rejects.toThrow();
	}, 1000 * 60);

	test('leave (Remove) で owner 側の members から外れ、発言できなくなる', async () => {
		await requestChat(bob, 'chat/rooms/leave', { roomId });

		await waitFor(() => isRoomMember(alice, roomId, bobInA.id).then(v => !v), { timeout: FED_TIMEOUT, interval: 1_000 });
		await waitFor(async () => !(await fetchJoiningRooms(bob)).some(r => r.id === roomId), { timeout: FED_TIMEOUT, interval: 1_000 });
		expect(await isRoomMember(alice, roomId, carolInA.id)).toBe(true);

		await expect(
			requestChat(bob, 'chat/messages/create-to-room', { toRoomId: roomId, text: `chat-fed-left-msg-${nonce()}` }),
		).rejects.toThrow();
	}, 1000 * 60);
});
