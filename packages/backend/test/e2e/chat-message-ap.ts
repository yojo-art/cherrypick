/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { describe, expect, test, beforeAll } from 'vitest';
import { api, signup, relativeFetch } from '../utils.js';
import type * as misskey from 'misskey-js';

type RawRes = { status: number; body: any; headers?: any };

describe('chat message is not disclosed via ActivityPub GET', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;
	let msgId: string;
	const secret = 'chat-ap-nondisclosure-secret-body';

	beforeAll(async () => {
		alice = await signup({ username: 'chat_ap_alice' });
		bob = await signup({ username: 'chat_ap_bob' });
		expect((await api('i/update' as any, { chatScope: 'everyone' } as any, alice) as RawRes).status).toBe(200);
		expect((await api('i/update' as any, { chatScope: 'everyone' } as any, bob) as RawRes).status).toBe(200);
		const dm = await api('chat/messages/create-to-user' as any, { toUserId: bob.id, text: secret } as any, alice) as RawRes;
		expect(dm.status).toBe(200);
		msgId = dm.body.id;
	});

	test('unauthenticated AP GET does not return the DM as ActivityPub', async () => {
		const res = await relativeFetch(`/chat/messages/${msgId}`, {
			headers: { Accept: 'application/activity+json' },
			redirect: 'manual',
		});
		const contentType = res.headers.get('content-type') ?? '';
		const text = await res.text();
		expect(contentType).not.toContain('activity+json');
		expect(text).not.toContain(secret);
	}, 1000 * 60);

	test('unauthenticated HTML GET does not contain the DM body', async () => {
		const res = await relativeFetch(`/chat/messages/${msgId}`, {
			headers: { Accept: 'text/html' },
			redirect: 'manual',
		});
		expect(await res.text()).not.toContain(secret);
	}, 1000 * 60);

	test('recipient can still read the message via authenticated API', async () => {
		const shown = await api('chat/messages/show' as any, { messageId: msgId } as any, bob) as RawRes;
		expect(shown.status).toBe(200);
		expect(shown.body.text).toBe(secret);
	}, 1000 * 60);
});
