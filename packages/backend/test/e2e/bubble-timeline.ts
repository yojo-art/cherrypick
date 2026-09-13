/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { beforeAll, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { api, port, post, randomString, signup } from '../utils.js';
import type * as misskey from 'misskey-js';

describe('Bubble timeline streaming (0222)', () => {
	let root: misskey.entities.SignupResponse;

	beforeAll(async () => {
		root = await signup({ username: 'bubble_root' });
		await api('admin/update-meta', { bubbleInstances: ['bubble.example'] }, root);
		// MetaService のキャッシュが Redis 経由で更新されるまで待つ
		await new Promise(resolve => setTimeout(resolve, 250));
	}, 1000 * 60);

	async function connectGuestChannel(channel: string, params?: Record<string, unknown>): Promise<{
		ws: WebSocket;
		waitForNote: (noteId: string) => Promise<any>;
	}> {
		const ws = new WebSocket(`ws://127.0.0.1:${port}/streaming`);

		const pending: any[] = [];
		const listeners: ((msg: any) => void)[] = [];

		await new Promise<void>((resolve, reject) => {
			ws.once('open', resolve);
			ws.once('error', reject);
			ws.once('unexpected-response', (_req, res) => reject(new Error(`unexpected response: ${res.statusCode}`)));
		});

		ws.on('message', data => {
			const msg = JSON.parse(data.toString());
			pending.push(msg);
			for (const listener of [...listeners]) listener(msg);
		});

		const waitFor = (cond: (msg: any) => boolean, timeout = 5000): Promise<any> => {
			for (const msg of pending) {
				if (cond(msg)) return Promise.resolve(msg);
			}
			return new Promise((resolve, reject) => {
				const listener = (msg: any) => {
					if (cond(msg)) {
						listeners.splice(listeners.indexOf(listener), 1);
						resolve(msg);
					}
				};
				listeners.push(listener);
				setTimeout(() => {
					const i = listeners.indexOf(listener);
					if (i >= 0) listeners.splice(i, 1);
					reject(new Error('timeout waiting for stream message'));
				}, timeout);
			});
		};

		ws.send(JSON.stringify({
			type: 'connect',
			body: { channel, id: 'a', pong: true, params },
		}));

		await waitFor(msg => msg.type === 'connected' && msg.body.id === 'a');

		return {
			ws,
			waitForNote: noteId => waitFor(msg =>
				msg.type === 'channel' && msg.body.id === 'a' && msg.body.type === 'note' && msg.body.body.id === noteId,
			).then(msg => msg.body.body),
		};
	}

	test('ゲストが bubble instance の公開ノートを受信できる', async () => {
		const remote = await signup({ username: randomString(), host: 'bubble.example' });
		const { ws, waitForNote } = await connectGuestChannel('bubbleTimeline');
		try {
			const note = await post(remote, { text: 'poc-0222', visibility: 'public' });
			const received = await waitForNote(note.id);
			expect(received.id).toBe(note.id);
			expect(received.user.host).toBe('bubble.example');

			// 背景で走る notesCount の更新がDB切断と競合しないよう待つ
			await new Promise(resolve => setTimeout(resolve, 500));
		} finally {
			ws.close();
		}
	}, 1000 * 60);
});
