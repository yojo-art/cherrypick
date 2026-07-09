/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import type { INestApplicationContext } from '@nestjs/common';
import { api, post, signup, startJobQueue, sleep } from '../utils.js';
import type * as misskey from 'misskey-js';

import { loadConfig } from '../../src/config.js';

const config = loadConfig();
const isOpenSearchEnabled = !!config.opensearch;

(isOpenSearchEnabled ? describe : describe.skip)('fullIndexPollVote 投票再インデックスのE2Eテスト', () => {
	let queue: INestApplicationContext;
	let root: misskey.entities.SignupResponse;
	let voter: misskey.entities.SignupResponse;

	beforeAll(async () => {
		queue = await startJobQueue();
		root = await signup({ username: 'root' });
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

		// OpenSearch への非同期インデックスを待つ
		await new Promise(resolve => setTimeout(resolve, 5000));
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await queue?.close();
	});

	async function getProgress(): Promise<{
		status: string | null;
		current: number | null;
		total: number | null;
	}> {
		const res = await api('admin/full-index-progress', { index: 'pollVote' }, root);
		assert.strictEqual(res.status, 200);
		return res.body;
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

	test('投票を再インデックスして0/0でないこと', async () => {
		const res = await api('admin/full-index', {
			index: 'pollVote',
			discardProgress: true,
		}, root);
		assert.strictEqual(res.status, 200);
		await sleep(1000);

		await waitForStatus('completed');

		const progress = await getProgress();
		assert.strictEqual(progress.status, 'completed');
		assert.ok(progress.current && progress.current > 0, `Expected current > 0, but got ${progress.current}`);
	});
});
