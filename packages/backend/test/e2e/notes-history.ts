/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Repository } from 'typeorm';
import type * as misskey from 'misskey-js';
import { MiUser } from '@/models/User.js';
import { api, initTestDb, post, signup } from '../utils.js';

type RawRes = { status: number, body: any };

describe('notes/history visibility', () => {
	let connection: Awaited<ReturnType<typeof initTestDb>>;
	let Users: Repository<MiUser>;
	let root: misskey.entities.SignupResponse;
	let author: misskey.entities.SignupResponse;
	let follower: misskey.entities.SignupResponse;
	let stranger: misskey.entities.SignupResponse;
	let mentionee: misskey.entities.SignupResponse;
	let replyTarget: misskey.entities.SignupResponse;
	let noteId: string;

	const oldText = 'notes history old text';
	const newText = 'notes history new text';

	// requireSigninToViewContents / makeNotes*Before は i/update で強制リセットされるため
	// (サードパーティ互換で paramDef のみ残存)、API 経由では設定できず DB を直接更新する。
	const setAuthorFlags = async (flags: {
		requireSigninToViewContents?: boolean,
		makeNotesHiddenBefore?: number | null,
		makeNotesFollowersOnlyBefore?: number | null,
	}) => {
		await Users.update(author.id, flags);
	};

	const getHistory = async (user?: misskey.entities.SignupResponse): Promise<RawRes> => {
		return await api('notes/history', { noteId, limit: 10 }, user) as RawRes;
	};

	beforeAll(async () => {
		root = await signup({ username: 'history_root' });
		author = await signup({ username: 'history_author' });
		follower = await signup({ username: 'history_follower' });
		stranger = await signup({ username: 'history_stranger' });
		mentionee = await signup({ username: 'history_mentionee' });
		replyTarget = await signup({ username: 'history_reply_target' });

		connection = await initTestDb(true);
		Users = connection.getRepository(MiUser);

		const note = await post(author, { text: oldText });
		noteId = note.id;
		await api('notes/update', { noteId, text: newText, cw: null }, author);

		await api('following/create', { userId: author.id }, follower);

		const res = await getHistory(author);
		expect((res.body as { text: string | null }[]).some(h => h.text === oldText)).toBe(true);
	}, 1000 * 60 * 3);

	afterAll(async () => {
		await setAuthorFlags({
			requireSigninToViewContents: false,
			makeNotesHiddenBefore: null,
			makeNotesFollowersOnlyBefore: null,
		});
		await api('admin/update-meta', { ugcVisibilityForVisitor: 'local' }, root);
		await connection.destroy();
	});

	test('公開ノートの履歴はゲストにも返る', async () => {
		const res = await getHistory();
		expect(res.status).toBe(200);
		expect((res.body as { text: string | null }[]).some(h => h.text === oldText)).toBe(true);
	});

	test('requireSigninToViewContents 有効時はゲストの履歴を拒否する', async () => {
		await setAuthorFlags({ requireSigninToViewContents: true });

		const show = await api('notes/show', { noteId }) as RawRes;
		expect(show.status).toBe(400);
		expect(show.body.error.code).toBe('CONTENT_RESTRICTED_BY_USER');

		const guest = await getHistory();
		expect(guest.status).toBe(400);
		expect(guest.body.error.code).toBe('CONTENT_RESTRICTED_BY_USER');

		const signedIn = await getHistory(stranger);
		expect(signedIn.status).toBe(200);
		expect((signedIn.body as { text: string | null }[]).some(h => h.text === oldText)).toBe(true);

		await setAuthorFlags({ requireSigninToViewContents: false });
	});

	test('makeNotesHiddenBefore 有効時は投稿者以外にリビジョンを返さない', async () => {
		await setAuthorFlags({ makeNotesHiddenBefore: Math.floor(Date.now() / 1000) + 3600 });

		const owner = await getHistory(author);
		expect(owner.status).toBe(200);
		expect((owner.body as { text: string | null }[]).some(h => h.text === oldText)).toBe(true);

		const other = await getHistory(stranger);
		expect(other.status).toBe(200);
		expect(other.body).toEqual([]);

		const guest = await getHistory();
		expect(guest.status).toBe(200);
		expect(guest.body).toEqual([]);

		await setAuthorFlags({ makeNotesHiddenBefore: null });
	});

	test('makeNotesFollowersOnlyBefore 有効時はフォロワー以外にリビジョンを返さない', async () => {
		await setAuthorFlags({ makeNotesFollowersOnlyBefore: Math.floor(Date.now() / 1000) + 3600 });

		const followerRes = await getHistory(follower);
		expect(followerRes.status).toBe(200);
		expect((followerRes.body as { text: string | null }[]).some(h => h.text === oldText)).toBe(true);

		const other = await getHistory(stranger);
		expect(other.status).toBe(200);
		expect(other.body).toEqual([]);

		const guest = await getHistory();
		expect(guest.status).toBe(200);
		expect(guest.body).toEqual([]);

		await setAuthorFlags({ makeNotesFollowersOnlyBefore: null });
	});

	test('makeNotesFollowersOnlyBefore 有効でもリプライ先・メンション先にはリビジョンを返す', async () => {
		const replySource = await post(replyTarget, { text: 'reply target note' });
		const replyNote = await post(author, { text: 'reply old text', replyId: replySource.id });
		await api('notes/update', { noteId: replyNote.id, text: 'reply new text', cw: null }, author);

		const mentionText = `@${mentionee.username} mention old text`;
		const mentionNote = await post(author, { text: mentionText });
		await api('notes/update', { noteId: mentionNote.id, text: 'mention new text', cw: null }, author);

		await setAuthorFlags({ makeNotesFollowersOnlyBefore: Math.floor(Date.now() / 1000) + 3600 });

		const replyRes = await api('notes/history', { noteId: replyNote.id, limit: 10 }, replyTarget) as RawRes;
		expect(replyRes.status).toBe(200);
		expect((replyRes.body as { text: string | null }[]).some(h => h.text === 'reply old text')).toBe(true);

		const mentionRes = await api('notes/history', { noteId: mentionNote.id, limit: 10 }, mentionee) as RawRes;
		expect(mentionRes.status).toBe(200);
		expect((mentionRes.body as { text: string | null }[]).some(h => h.text === mentionText)).toBe(true);

		const strangerOnReply = await api('notes/history', { noteId: replyNote.id, limit: 10 }, stranger) as RawRes;
		expect(strangerOnReply.status).toBe(200);
		expect(strangerOnReply.body).toEqual([]);

		const strangerOnMention = await api('notes/history', { noteId: mentionNote.id, limit: 10 }, stranger) as RawRes;
		expect(strangerOnMention.status).toBe(200);
		expect(strangerOnMention.body).toEqual([]);

		await setAuthorFlags({ makeNotesFollowersOnlyBefore: null });
	});

	test('ugcVisibilityForVisitor=none のときゲストの履歴を拒否する', async () => {
		await api('admin/update-meta', { ugcVisibilityForVisitor: 'none' }, root);

		const show = await api('notes/show', { noteId }) as RawRes;
		expect(show.status).toBe(400);
		expect(show.body.error.code).toBe('CONTENT_RESTRICTED_BY_SERVER');

		const history = await getHistory();
		expect(history.status).toBe(400);
		expect(history.body.error.code).toBe('CONTENT_RESTRICTED_BY_SERVER');

		await api('admin/update-meta', { ugcVisibilityForVisitor: 'local' }, root);
	});
});
