/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, test } from 'vitest';
import * as Misskey from 'misskey-js';
import { createAccount, federationTestStubUri, resolveRemoteUser, sleep, waitFor, type LoginUser } from './utils.js';

// specified (DM) ノートの編集がフォロワー (zack@z.test) に配送されないことを確認する。
// - 観測: z.test の /inbox 受信を stub-deliver が記録し、/received で参照できる
// - public / followers ノートの編集が zack に届くこと (配送パイプライン生存の sanity) も確認する
describe('note updates respect visibility when delivered to followers', () => {
	let alice: LoginUser;
	let bob: LoginUser;
	let bobInA: Misskey.entities.UserDetailedNotMe;
	let followersProbeText: string;
	let dmText: string;

	async function zackReceived(text: string): Promise<boolean> {
		const res = await fetch(`${federationTestStubUri('received')}?text=${encodeURIComponent(text)}`);
		strictEqual(res.status, 200);
		const list = await res.json() as unknown[];
		return list.length > 0;
	}

	async function makeZackFollowAlice(): Promise<void> {
		const res = await fetch(federationTestStubUri('follow'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ targetHost: 'a.test', object: `https://a.test/users/${alice.id}` }),
		});
		strictEqual(res.status, 200);
		const body = await res.json() as { inboxStatus?: number };
		strictEqual(body.inboxStatus, 202);

		await waitFor(async () => {
			try {
				const follows = await alice.client.request('users/followers', { userId: alice.id, limit: 100 });
				return follows.some((f: any) => f.follower?.username === 'federation-test-zack' || f.follower?.host === 'z.test');
			} catch {
				return false;
			}
		}, { timeout: 30_000 });
	}

	beforeAll(async () => {
		const step = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
			try {
				return await fn();
			} catch (e: any) {
				throw new Error(`STEP ${name} failed: ${e?.message ?? String(e)} (code=${e?.code ?? e?.error?.code})`);
			}
		};

		[alice, bob] = await step('createAccount', () => Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
		]));

		bobInA = await step('resolveRemoteUser', () => resolveRemoteUser('b.test', bob.id, alice));

		await step('zack follows alice', () => makeZackFollowAlice());

		followersProbeText = `update-delivery probe ${randomUUID()}`;
		dmText = `update-delivery dm ${randomUUID()}`;

		// 観測チャネルの sanity: public ノートの編集が zack に届く
		const publicNote = (await step('public notes/create', () => alice.client.request('notes/create', { text: 'update-delivery public' }))).createdNote;
		await step('public notes/update', () => alice.client.request('notes/update' as any, { noteId: publicNote.id, text: followersProbeText, cw: null } as any));
		await step('wait probe delivery', () => waitFor(() => zackReceived(followersProbeText), { timeout: 60_000 }));
	}, 1000 * 60 * 3);

	test('followers ノートの編集はフォロワーに届く', async () => {
		const text = `update-delivery followers ${randomUUID()}`;
		const note = (await alice.client.request('notes/create', { text: 'update-delivery followers old', visibility: 'followers' })).createdNote;
		await alice.client.request('notes/update' as any, { noteId: note.id, text, cw: null } as any);

		await waitFor(() => zackReceived(text), { timeout: 60_000 });
		expect(await zackReceived(text)).toBe(true);
	}, 1000 * 60);

	test('specified (DM) ノートの編集はフォロワーに届かない', async () => {
		const note = (await alice.client.request('notes/create', {
			text: 'update-delivery dm old',
			visibility: 'specified',
			visibleUserIds: [bobInA.id],
		})).createdNote;
		await alice.client.request('notes/update' as any, { noteId: note.id, text: dmText, cw: null } as any);

		// 配送キューの消化を待つため、後続の public probe が届くのを確認してから absence を判定する
		const probeText = `update-delivery probe ${randomUUID()}`;
		const probe = (await alice.client.request('notes/create', { text: 'update-delivery probe old' })).createdNote;
		await alice.client.request('notes/update' as any, { noteId: probe.id, text: probeText, cw: null } as any);
		await waitFor(() => zackReceived(probeText), { timeout: 60_000 });

		await sleep(3000);
		expect(await zackReceived(dmText)).toBe(false);
	}, 1000 * 60);
});
