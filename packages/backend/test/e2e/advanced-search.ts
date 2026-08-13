/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { api, post, role, signup, startJobQueue, sleep } from '../utils.js';
import type * as misskey from 'misskey-js';
import { describeOpenSearchE2E } from '../helpers/describe-opensearch-e2e.js';

describeOpenSearchE2E('advanced-search E2Eテスト', { requireOpenSearch: true }, () => {
	let queue: INestApplicationContext;
	let root: misskey.entities.SignupResponse;

	beforeAll(async () => {
		queue = await startJobQueue();
		root = await signup({ username: 'root' });

		const rateLimitRole = await role(root, { name: 'No Rate Limit' }, {
			rateLimitFactor: { priority: 0, useDefault: false, value: 0 },
		});
		await api('admin/roles/assign', {
			roleId: rateLimitRole.id,
			userId: root.id,
		}, root);
	}, 60000);

	afterAll(async () => {
		await queue?.close();
	});

	async function getProgress(index: 'notes' | 'reaction' | 'pollVote' | 'clipNotes' | 'Favorites'): Promise<{
		status: string | null;
		current: number | null;
		total: number | null;
	}> {
		const res = await api('admin/full-index-progress', { index }, root);
		assert.strictEqual(res.status, 200);
		return res.body;
	}

	async function waitForStatus(index: 'notes' | 'reaction' | 'pollVote' | 'clipNotes' | 'Favorites', expected: string | string[], timeoutMs = 180000): Promise<void> {
		const expectedList = Array.isArray(expected) ? expected : [expected];
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const progress = await getProgress(index);
			if (progress.status != null && expectedList.includes(progress.status)) return;
			await sleep(1000);
		}
		const last = await getProgress(index);
		throw new Error(`Timeout waiting for status: ${expectedList.join('|')} (last: ${last.status}, current: ${last.current})`);
	}

	describe('fullIndexNote 一時停止・再開・完了のE2Eテスト', () => {
		// note の batchLimit は 1000 のため、limitCount より大きい単位で処理される。
		// チャンク分割の検証には batchLimit を超える件数が必要。
		const NOTE_COUNT = 2200;
		const BATCH_LIMIT = 1000;
		const LIMIT_COUNT = 50;

		beforeAll(async () => {
			for (let i = 0; i < NOTE_COUNT; i++) {
				await post(root, { text: `fullIndexNote_test_${i}` });
			}

			const userInfo = await api('users/show', { userId: root.id }, root);
			assert.strictEqual(userInfo.status, 200);
			assert.strictEqual(userInfo.body.notesCount, NOTE_COUNT, `Expected ${NOTE_COUNT} notes, but got ${userInfo.body.notesCount}`);
			await sleep();
		}, 300000);

		function isPausedLike(status: string | null): boolean {
			// limitCount 到達後に自動再開が予約されると、API 上は queued と表示される
			return status === 'paused' || status === 'queued';
		}

		test('1チャンク処理して一時停止する', async () => {
			const res = await api('admin/full-index', {
				index: 'notes',
				limitCount: LIMIT_COUNT,
				intervalMinutes: 1,
				discardProgress: true,
			}, root);
			assert.strictEqual(res.status, 200);
			await sleep(1000);

			await waitForStatus('notes', ['paused', 'queued']);

			const progress = await getProgress('notes');
			assert.ok(isPausedLike(progress.status));
			assert.strictEqual(progress.current, BATCH_LIMIT);
		});

		test('続きを実行して2チャンク目で一時停止する', async () => {
			const res = await api('admin/full-index', {
				index: 'notes',
				limitCount: LIMIT_COUNT,
				intervalMinutes: 1,
			}, root);
			assert.strictEqual(res.status, 200);
			await sleep(1000);

			await waitForStatus('notes', ['paused', 'queued']);

			const progress = await getProgress('notes');
			assert.ok(isPausedLike(progress.status));
			assert.strictEqual(progress.current, BATCH_LIMIT * 2);
		});

		test('残りを全件実行して完了する', async () => {
			const res = await api('admin/full-index', {
				index: 'notes',
				intervalMinutes: 1,
			}, root);
			assert.strictEqual(res.status, 200);

			await waitForStatus('notes', 'completed');

			const progress = await getProgress('notes');
			assert.strictEqual(progress.status, 'completed');
			assert.ok(progress.current && progress.current >= NOTE_COUNT);
		});
	});

	describe('fullIndexPollVote 投票再インデックスのE2Eテスト', () => {
		let voter: misskey.entities.SignupResponse;

		beforeAll(async () => {
			voter = await signup({ username: 'voter' });

			// 投票付きノートを作成し、投票を行う
			const pollNote = await post(root, {
				text: 'poll_test',
				poll: {
					choices: ['choice_a', 'choice_b'],
					multiple: false,
				},
			});

			const voteRes = await api('notes/polls/vote', {
				noteId: pollNote.id,
				choice: 0,
			}, voter);
			assert.strictEqual(voteRes.status, 204);
			await sleep();
		});

		test('投票を再インデックスして0/0でないこと', async () => {
			const res = await api('admin/full-index', {
				index: 'pollVote',
				discardProgress: true,
			}, root);
			assert.strictEqual(res.status, 200);
			await sleep(1000);

			await waitForStatus('pollVote', 'completed');

			const progress = await getProgress('pollVote');
			assert.strictEqual(progress.status, 'completed');
			assert.ok(progress.current && progress.current > 0, `Expected current > 0, but got ${progress.current}`);
		});
	});

	describe('fullIndexReaction リアクション再インデックスのE2Eテスト', () => {
		let reactor: misskey.entities.SignupResponse;

		beforeAll(async () => {
			reactor = await signup({ username: 'reactor' });

			const note = await post(root, { text: 'reaction_test' });

			const reactionRes = await api('notes/reactions/create', {
				noteId: note.id,
				reaction: '👍',
			}, reactor);
			assert.strictEqual(reactionRes.status, 204);
			await sleep();
		});

		test('リアクションを再インデックスして0/0でないこと', async () => {
			const res = await api('admin/full-index', {
				index: 'reaction',
				discardProgress: true,
			}, root);
			assert.strictEqual(res.status, 200);
			await sleep(1000);

			await waitForStatus('reaction', 'completed');

			const progress = await getProgress('reaction');
			assert.strictEqual(progress.status, 'completed');
			assert.ok(progress.current && progress.current > 0, `Expected current > 0, but got ${progress.current}`);
		});
	});

	describe('fullIndexClipNotes クリップノート再インデックスのE2Eテスト', () => {
		beforeAll(async () => {
			const clipRes = await api('clips/create', {
				name: 'test_clip',
				isPublic: false,
			}, root);
			assert.strictEqual(clipRes.status, 200);
			const clipId = clipRes.body.id;

			const note = await post(root, { text: 'clip_test' });

			const addRes = await api('clips/add-note', {
				clipId,
				noteId: note.id,
			}, root);
			assert.strictEqual(addRes.status, 204);
			await sleep();
		});

		test('クリップノートを再インデックスして0/0でないこと', async () => {
			const res = await api('admin/full-index', {
				index: 'clipNotes',
				discardProgress: true,
			}, root);
			assert.strictEqual(res.status, 200);
			await sleep(1000);

			await waitForStatus('clipNotes', 'completed');

			const progress = await getProgress('clipNotes');
			assert.strictEqual(progress.status, 'completed');
			assert.ok(progress.current && progress.current > 0, `Expected current > 0, but got ${progress.current}`);
		});
	});

	describe('fullIndexFavorites お気に入り再インデックスのE2Eテスト', () => {
		let favoriter: misskey.entities.SignupResponse;

		beforeAll(async () => {
			favoriter = await signup({ username: 'favoriter' });

			const note = await post(root, { text: 'favorite_test' });

			const favoriteRes = await api('notes/favorites/create', {
				noteId: note.id,
			}, favoriter);
			assert.strictEqual(favoriteRes.status, 204);
			await sleep();
		});

		test('お気に入りを再インデックスして0/0でないこと', async () => {
			const res = await api('admin/full-index', {
				index: 'Favorites',
				discardProgress: true,
			}, root);
			assert.strictEqual(res.status, 200);
			await sleep(1000);

			await waitForStatus('Favorites', 'completed');

			const progress = await getProgress('Favorites');
			assert.strictEqual(progress.status, 'completed');
			assert.ok(progress.current && progress.current > 0, `Expected current > 0, but got ${progress.current}`);
		});
	});
});
