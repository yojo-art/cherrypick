/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import type { INestApplicationContext } from '@nestjs/common';
import { api, post, role, signup, startJobQueue, sleep } from '../utils.js';
import type * as misskey from 'misskey-js';

import { loadConfig } from '../../src/config.js';

const config = loadConfig();
const isOpenSearchEnabled = !!config.opensearch;

// note の batchLimit は 1000 のため、limitCount より大きい単位で処理される。
// チャンク分割の検証には batchLimit を超える件数が必要。
const NOTE_COUNT = 2200;
const BATCH_LIMIT = 1000;
const LIMIT_COUNT = 50;

(isOpenSearchEnabled ? describe : describe.skip)('fullIndexNote 一時停止・再開・完了のE2Eテスト', () => {
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

		for (let i = 0; i < NOTE_COUNT; i++) {
			await post(root, { text: `fullIndexNote_test_${i}` });
		}

		const userInfo = await api('users/show', { userId: root.id }, root);
		assert.strictEqual(userInfo.status, 200);
		assert.strictEqual(userInfo.body.notesCount, NOTE_COUNT, `Expected ${NOTE_COUNT} notes, but got ${userInfo.body.notesCount}`);

		await new Promise(resolve => setTimeout(resolve, 5000));
	}, 1000 * 60 * 5);

	afterAll(async () => {
		await queue?.close();
	});

	async function getProgress(): Promise<{
		status: string | null;
		current: number | null;
		total: number | null;
	}> {
		const res = await api('admin/full-index-progress', { index: 'notes' }, root);
		assert.strictEqual(res.status, 200);
		return res.body;
	}

	function isPausedLike(status: string | null): boolean {
		// limitCount 到達後に自動再開が予約されると、API 上は queued と表示される
		return status === 'paused' || status === 'queued';
	}

	async function waitForStatus(expected: string | string[], timeoutMs = 180000): Promise<void> {
		const expectedList = Array.isArray(expected) ? expected : [expected];
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const progress = await getProgress();
			if (progress.status != null && expectedList.includes(progress.status)) return;
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		const last = await getProgress();
		throw new Error(`Timeout waiting for status: ${expectedList.join('|')} (last: ${last.status}, current: ${last.current})`);
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

		await waitForStatus(['paused', 'queued']);

		const progress = await getProgress();
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

		await waitForStatus(['paused', 'queued']);

		const progress = await getProgress();
		assert.ok(isPausedLike(progress.status));
		assert.strictEqual(progress.current, BATCH_LIMIT * 2);
	});

	test('残りを全件実行して完了する', async () => {
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
