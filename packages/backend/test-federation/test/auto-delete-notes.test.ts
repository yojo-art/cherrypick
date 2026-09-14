/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { strictEqual } from 'node:assert';
import { Client } from 'pg';
import { Queue } from 'bullmq';
import { beforeAll, describe, expect, test } from 'vitest';
import * as Misskey from 'misskey-js';
import { createAccount, federationTestStubUri, sleep, waitFor, type LoginUser } from './utils.js';

// auto-delete job が NoteDeleteService 経由で削除し、AP Delete を連合先へ配送することを確認する。
// - zack@z.test が alice@a.test をフォローし、z.test の記録 inbox を観測する
// - a.test の DB に直接 backdated ノートを挿入し、a.test の system queue に autoDeleteNotes を enqueue する
describe('auto-deleteNotes delivers AP Delete to followers', () => {
	let alice: LoginUser;
	let oldNoteId: string;
	let oldNoteText: string;

	const dbConfig = {
		host: 'db.a.test',
		port: 5432,
		user: 'postgres',
		password: 'postgres',
		database: 'misskey',
	};

	function genBackdatedAidxId(daysAgo: number): string {
		const time = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
		return `${(time - 946684800000).toString(36).padStart(8, '0')}00000000`;
	}

	async function zTestReceived(text: string): Promise<unknown[]> {
		const res = await fetch(`${federationTestStubUri('received')}?text=${encodeURIComponent(text)}`);
		strictEqual(res.status, 200);
		return await res.json() as unknown[];
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

	async function insertBackdatedNote(): Promise<void> {
		const client = new Client(dbConfig);
		await client.connect();
		try {
			await client.query(
				'INSERT INTO "note" (id, "userId", text, cw, visibility, "searchableBy") VALUES ($1, $2, $3, $4, $5, $6)',
				[oldNoteId, alice.id, oldNoteText, null, 'public', 'public'],
			);
		} finally {
			await client.end();
		}
	}

	async function enqueueAutoDeleteNotes(): Promise<void> {
		const queue = new Queue('system', {
			connection: { host: 'redis.test', port: 6379 },
			prefix: 'a.test:queue:system',
		});
		try {
			await queue.add('autoDeleteNotes', {}, { removeOnComplete: true });
		} finally {
			await queue.close();
		}
	}

	beforeAll(async () => {
		const step = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
			try {
				return await fn();
			} catch (e: any) {
				throw new Error(`STEP ${name} failed: ${e?.message ?? String(e)} (code=${e?.code ?? e?.error?.code})`);
			}
		};

		alice = await step('createAccount', () => createAccount('a.test'));

		await step('enable auto-delete', () => alice.client.request('i/update-auto-delete-settings' as any, {
			autoDeleteNotesAfterDays: 1,
		} as any));

		await step('zack follows alice', () => makeZackFollowAlice());

		oldNoteId = genBackdatedAidxId(3);
		oldNoteText = `auto-delete fed old note ${oldNoteId}`;

		await step('insert backdated note', () => insertBackdatedNote());

		// 挿入したノートが notes/show で見えることを確認する (削除前の sanity)
		const shown = await step('notes/show before delete', () => alice.client.request('notes/show', { noteId: oldNoteId }));
		expect(shown.id).toBe(oldNoteId);
	}, 1000 * 60 * 3);

	test('auto-delete job で削除され、AP Delete がフォロワーに配送される', async () => {
		await enqueueAutoDeleteNotes();

		// NoteDeleteService 経由なら Tombstone 付きの Delete が zack に届く (素の DELETE なら何も届かない)
		await waitFor(async () => {
			const list = await zTestReceived(oldNoteId);
			return list.length > 0;
		}, { timeout: 60_000 });

		const list = await zTestReceived(oldNoteId);
		expect(list.length).toBeGreaterThan(0);
		expect(JSON.stringify(list).includes('Tombstone')).toBe(true);

		await sleep(2000);

		let code: string | undefined;
		try {
			await alice.client.request('notes/show', { noteId: oldNoteId });
		} catch (err: any) {
			code = err?.code ?? err?.error?.code;
		}
		expect(code).toBe('NO_SUCH_NOTE');
	}, 1000 * 60);
});
