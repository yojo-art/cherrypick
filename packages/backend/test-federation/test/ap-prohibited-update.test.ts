/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { rejects, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import * as Misskey from 'misskey-js';
import { createAccount, fetchAdmin, resolveRemoteNote, resolveRemoteUser, waitFor, type LoginUser } from './utils.js';

// リモート (b.test) からの Update(Note) に禁止語が含まれる場合、受信側 (a.test) が
// 複製を更新しないことを確認する回帰テスト (updateNote の禁止語チェック欠落)。
// - a.test で prohibitedWords を設定し、ローカル create が拒否されることを対照確認する
// - b.test の bob が clean なノートを投稿 → a.test に複製される → 禁止語入りに編集 → clean に再編集
// - a.test の notes/history に禁止語入りの旧内容が残っていないことを確認する
//   (修正が無ければ、clean への再編集時に「直前の禁止語入り内容」が history に記録される)
describe('remote note updates containing prohibited words are rejected', () => {
	const prohibitedWord = `apbanned${randomUUID().replaceAll('-', '').substring(0, 8)}`;
	let alice: LoginUser;
	let bob: LoginUser;
	let bobInA: Misskey.entities.UserDetailedNotMe;

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

		await step('enable prohibited words on a.test', async () => {
			const admin = await fetchAdmin('a.test');
			await admin.client.request('admin/update-meta', { prohibitedWords: [prohibitedWord] });
		});

		// bob の Update が a.test へ配送されるよう、alice が bob をフォローして成立を待つ
		await step('alice follows bob', () => alice.client.request('following/create', { userId: bobInA.id }));
		await step('wait follow accepted', () => waitFor(async () => {
			try {
				const followers = await bob.client.request('users/followers', { userId: bob.id, limit: 100 });
				return followers.some(f => f.follower?.host === 'a.test' && f.follower.username === alice.username);
			} catch {
				return false;
			}
		}, { timeout: 60_000 }));
	}, 1000 * 60 * 5);

	afterAll(async () => {
		const admin = await fetchAdmin('a.test');
		await admin.client.request('admin/update-meta', { prohibitedWords: [] });
	});

	test('対照: ローカルの禁止語入りノート作成は拒否される', async () => {
		await rejects(
			async () => await alice.client.request('notes/create', { text: `prohibited-update control ${prohibitedWord}` }),
			(err: any) => {
				strictEqual(err.code, 'CONTAINS_PROHIBITED_WORDS');
				return true;
			},
		);
	});

	test('禁止語入りのリモート編集は a.test の複製に保存されない', async () => {
		const oldText = `prohibited-update old ${randomUUID()}`;
		const bannedText = `prohibited-update ${prohibitedWord} ${randomUUID()}`;
		const finalText = `prohibited-update final ${randomUUID()}`;

		// b.test には禁止語が無いため、初期投稿・編集ともに成功し Update が a.test へ配送される
		const note = (await bob.client.request('notes/create', { text: oldText })).createdNote;
		const copy = await resolveRemoteNote('b.test', note.id, alice);
		strictEqual(copy.text, oldText);

		await bob.client.request('notes/update' as any, { noteId: note.id, text: bannedText, cw: null } as any);
		await bob.client.request('notes/update' as any, { noteId: note.id, text: finalText, cw: null } as any);

		// finalText が a.test の複製に反映されるまで待つ。同一ノートの Update はロックで直列化されるため、
		// この時点で bannedText の Update も処理済み (拒否されていれば保存されていない)
		await waitFor(async () => {
			try {
				return (await resolveRemoteNote('b.test', note.id, alice)).text === finalText;
			} catch {
				return false;
			}
		}, { timeout: 60_000 });

		// history は更新直前の内容を記録する。finalText への更新分の記録完了を待ってから検証する
		let history: Misskey.entities.NoteHistory[] = [];
		await waitFor(async () => {
			try {
				history = await alice.client.request('notes/history', { noteId: copy.id, limit: 100 });
				return history.length > 0;
			} catch {
				return false;
			}
		}, { timeout: 30_000 });

		expect(history.some(h => h.text?.includes(prohibitedWord))).toBe(false);
	}, 1000 * 60 * 5);
});
