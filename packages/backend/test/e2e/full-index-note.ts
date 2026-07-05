/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { api, post, signup } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('fullIndexNote 一時停止・再開・完了のE2Eテスト', () => {
	let root: misskey.entities.SignupResponse;
	const notes: misskey.entities.Note[] = [];
	const NOTE_COUNT = 300;
	const LIMIT_COUNT = 50;
	let isEnabled = true;

	beforeAll(async () => {
		root = await signup({ username: 'root' });

		// 高度な検索が有効かチェック
		const iRes = await api('i', {}, root);
		isEnabled = iRes.body.policies?.canAdvancedSearchNotes ?? false;
		if (!isEnabled) {
			console.log('高度な検索が無効なため fullIndexNote E2E テストをスキップします');
			return;
		}

		// 300件のノートを作成
		for (let i = 0; i < NOTE_COUNT; i++) {
			const note = await post(root, { text: `fullIndexNote_test_${i}` });
			notes.push(note);
		}
		// OpenSearchへの反映を待つ
		await new Promise(resolve => setTimeout(resolve, 5000));
	}, 1000 * 60 * 2);

	async function getProgress(): Promise<{
		status: string | null;
		current: number | null;
		total: number | null;
	}> {
		const res = await api('admin/full-index-progress', {}, root);
		assert.strictEqual(res.status, 200);
		return res.body;
	}

	async function waitForStatus(expected: string, timeoutMs = 60000): Promise<void> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const progress = await getProgress();
			if (progress.status === expected) return;
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		throw new Error(`Timeout waiting for status: ${expected}`);
	}

	const testIfEnabled = isEnabled ? test : test.skip;

	testIfEnabled('50件ずつ処理して一時停止する', async () => {
		// 既存の progress を破棄して最初から開始
		const res = await api('admin/full-index', {
			index: 'notes',
			limitCount: LIMIT_COUNT,
			intervalMinutes: 1,
			discardProgress: true,
		}, root);
		assert.strictEqual(res.status, 200);

		// paused になるまで待つ
		await waitForStatus('paused');

		const progress = await getProgress();
		assert.strictEqual(progress.status, 'paused');
		assert.strictEqual(progress.current, LIMIT_COUNT);
		assert.ok(progress.total && progress.total >= NOTE_COUNT);
	});

	testIfEnabled('続きを実行して100件になる', async () => {
		const res = await api('admin/full-index', {
			index: 'notes',
			limitCount: LIMIT_COUNT,
			intervalMinutes: 1,
		}, root);
		assert.strictEqual(res.status, 200);

		await waitForStatus('paused');

		const progress = await getProgress();
		assert.strictEqual(progress.status, 'paused');
		assert.strictEqual(progress.current, LIMIT_COUNT * 2);
	});

	testIfEnabled('残りを全件実行して完了する', async () => {
		// limitCountなしで実行（残りすべてを一度に処理）
		const res = await api('admin/full-index', {
			index: 'notes',
			intervalMinutes: 1,
		}, root);
		assert.strictEqual(res.status, 200);

		await waitForStatus('completed');

		const progress = await getProgress();
		assert.strictEqual(progress.status, 'completed');
		assert.ok(progress.current && progress.current >= NOTE_COUNT);
	});
});
