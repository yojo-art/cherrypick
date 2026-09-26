/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { INestApplicationContext } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type * as misskey from 'misskey-js';
import { MiNote } from '@/models/Note.js';
import { IdService } from '@/core/IdService.js';
import { loadConfig } from '@/config.js';
import { AutoDeleteNotesProcessorService } from '@/queue/processors/AutoDeleteNotesProcessorService.js';
import { api, initTestDb, post, signup, startJobQueue } from '../utils.js';

type RawRes = { status: number, body: any };

describe('auto-delete notes', () => {
	let queue: INestApplicationContext;
	let connection: DataSource;
	let idService: IdService;

	const oldId = () => idService.gen(Date.now() - 3 * 24 * 60 * 60 * 1000);

	async function insertOldNote(user: misskey.entities.SignupResponse, overrides: Partial<MiNote> = {}): Promise<string> {
		const id = oldId();
		await connection.getRepository(MiNote).insert({
			id,
			userId: user.id,
			userHost: null,
			text: `auto-delete-old-${id}`,
			cw: null,
			visibility: 'public',
			searchableBy: 'public',
			...overrides,
		});
		return id;
	}

	async function runJob(): Promise<{ deletedCount: number, processedUsers: number }> {
		return await queue.get(AutoDeleteNotesProcessorService).process({} as any);
	}

	beforeAll(async () => {
		queue = await startJobQueue();
		connection = await initTestDb(true);
		idService = new IdService(loadConfig());
	}, 1000 * 60 * 3);

	afterAll(async () => {
		await connection.destroy();
		await queue.close();
	});

	test('期限切れノートは NoteDeleteService で削除される (返信カウンタが減り、新しいノートは残る)', async () => {
		const alice = await signup({ username: 'autodel_alice' });
		await api('i/update-auto-delete-settings' as any, { autoDeleteNotesAfterDays: 1 } as any, alice);

		const parent = await post(alice, { text: 'auto-delete parent' });
		const oldReplyId = await insertOldNote(alice, { replyId: parent.id });
		await connection.getRepository(MiNote).increment({ id: parent.id }, 'repliesCount', 1);

		const fresh = await post(alice, { text: 'auto-delete fresh' });

		const stats = await runJob();
		expect(stats.deletedCount).toBeGreaterThanOrEqual(1);

		const notes = connection.getRepository(MiNote);
		// 期限切れノートは削除される
		expect(await notes.findOneBy({ id: oldReplyId })).toBeNull();
		// NoteDeleteService 経由なら親の返信カウンタが減算される (素の DELETE なら 1 のまま)
		expect((await notes.findOneByOrFail({ id: parent.id })).repliesCount).toBe(0);
		// 期限内のノートは残る
		expect((await notes.findOneBy({ id: fresh.id }))?.id).toBe(fresh.id);
	}, 1000 * 60);

	test('autoDeleteKeepFavorites が有効な場合は favorite 済みノートが残る', async () => {
		const bob = await signup({ username: 'autodel_bob' });
		await api('i/update-auto-delete-settings' as any, { autoDeleteNotesAfterDays: 1, autoDeleteKeepFavorites: true } as any, bob);

		const favId = await insertOldNote(bob, {});
		const otherId = await insertOldNote(bob, {});
		const fav = await api('notes/favorites/create' as any, { noteId: favId } as any, bob) as RawRes;
		expect(fav.status).toBe(204);

		await runJob();

		const notes = connection.getRepository(MiNote);
		expect((await notes.findOneBy({ id: favId }))?.id).toBe(favId);
		expect(await notes.findOneBy({ id: otherId })).toBeNull();
	}, 1000 * 60);
});
