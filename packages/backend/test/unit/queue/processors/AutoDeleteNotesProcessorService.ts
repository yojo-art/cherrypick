/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import type { Mocked } from 'vitest';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'vitest-mock-extended';
import { IsNull, Not } from 'typeorm';
import type { TestingModule } from '@nestjs/testing';
import { AutoDeleteNotesProcessorService } from '@/queue/processors/AutoDeleteNotesProcessorService.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { IdService } from '@/core/IdService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import { DI } from '@/di-symbols.js';
import type { MiNote } from '@/models/Note.js';
import type { MiUser } from '@/models/User.js';

describe('AutoDeleteNotesProcessorService', () => {
	let app: TestingModule;
	let service: AutoDeleteNotesProcessorService;
	let noteDeleteService: Mocked<NoteDeleteService>;
	const mockUsersRepository = { findBy: vi.fn() };
	const mockNotesRepository = { createQueryBuilder: vi.fn(), delete: vi.fn() };
	const mockIdService = { gen: vi.fn() };
	const mockLogger = { info: vi.fn(), error: vi.fn(), succ: vi.fn() };
	const mockRedisClient = { set: vi.fn(), eval: vi.fn() };

	const user = {
		id: 'alice',
		autoDeleteNotesAfterDays: 1,
		autoDeleteKeepFavorites: false,
	} as unknown as MiUser;

	const noteA = { id: 'note-a', userId: 'alice' } as MiNote;
	const noteB = { id: 'note-b', userId: 'alice' } as MiNote;

	function mockQueryBuilder(notes: MiNote[]) {
		const qb = {
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			getMany: vi.fn().mockResolvedValue(notes),
		};
		mockNotesRepository.createQueryBuilder.mockReturnValue(qb);
		return qb;
	}

	beforeAll(async () => {
		app = await Test.createTestingModule({
			providers: [
				AutoDeleteNotesProcessorService,
				{ provide: DI.usersRepository, useValue: mockUsersRepository },
				{ provide: DI.notesRepository, useValue: mockNotesRepository },
				{ provide: DI.redis, useValue: mockRedisClient },
				{ provide: IdService, useValue: mockIdService },
				{ provide: QueueLoggerService, useValue: { logger: { createSubLogger: () => mockLogger } } },
			],
		})
			.useMocker((token) => {
				if (typeof token === 'function') {
					return mockDeep<typeof token>();
				}
			})
			.compile();

		app.enableShutdownHooks();

		service = app.get<AutoDeleteNotesProcessorService>(AutoDeleteNotesProcessorService);
		noteDeleteService = app.get<NoteDeleteService>(NoteDeleteService) as Mocked<NoteDeleteService>;

		mockIdService.gen.mockReturnValue('threshold-id');
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		// ロックは既定で取得できることにする(competing lock のテストでは個別に上書きする)
		mockRedisClient.set.mockResolvedValue('OK');
		mockRedisClient.eval.mockResolvedValue(1);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// SUB_BATCH_SIZE 単位のチャンク間で sleep が入るため、フェイクタイマーを進めながら実行する
	async function runProcess() {
		const promise = service.process({} as any);
		await vi.runAllTimersAsync();
		return await promise;
	}

	test('対象ノートは NoteDeleteService 経由で削除され、素の repository.delete は呼ばれない', async () => {
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder([noteA, noteB]);
		noteDeleteService.delete.mockResolvedValue(undefined);

		const stats = await runProcess();

		expect(noteDeleteService.delete).toHaveBeenCalledTimes(2);
		expect(noteDeleteService.delete).toHaveBeenNthCalledWith(1, user, noteA);
		expect(noteDeleteService.delete).toHaveBeenNthCalledWith(2, user, noteB);
		expect(mockNotesRepository.delete).not.toHaveBeenCalled();
		expect(stats).toEqual({ deletedCount: 2, processedUsers: 1 });
	});

	test('SUB_BATCH_SIZE (5件) を超える分は複数チャンクに分けてロック延長を挟みながら削除される', async () => {
		const notes7 = Array.from({ length: 7 }, (_, i) => ({ id: `note-${i}`, userId: 'alice' } as MiNote));
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder(notes7);
		noteDeleteService.delete.mockResolvedValue(undefined);

		const stats = await runProcess();

		expect(noteDeleteService.delete).toHaveBeenCalledTimes(7);
		// 5件目までの1チャンク目と、残り2件の2チャンク目でロック延長が1回ずつ走り、
		// 最後に redisClient.eval によるロック解放が1回走る (延長2回 + 解放1回 = 3回)
		expect(mockRedisClient.eval).toHaveBeenCalledTimes(3);
		expect(stats).toEqual({ deletedCount: 7, processedUsers: 1 });
	});

	test('削除対象は note.id 昇順(古い順)で取得する', async () => {
		mockUsersRepository.findBy.mockResolvedValue([user]);
		const qb = mockQueryBuilder([noteA]);
		noteDeleteService.delete.mockResolvedValue(undefined);

		await runProcess();

		expect(qb.orderBy).toHaveBeenCalledWith('note.id', 'ASC');
	});

	test('autoDeleteKeepFavorites が有効な場合は favorite を除外する条件が付く', async () => {
		mockUsersRepository.findBy.mockResolvedValue([{ ...user, autoDeleteKeepFavorites: true }]);
		const qb = mockQueryBuilder([noteA]);
		noteDeleteService.delete.mockResolvedValue(undefined);

		await runProcess();

		expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('note_favorite'));
		expect(noteDeleteService.delete).toHaveBeenCalledTimes(1);
	});

	test('autoDeleteKeepFavorites が無効な場合は除外条件が付かない', async () => {
		mockUsersRepository.findBy.mockResolvedValue([{ ...user, autoDeleteKeepFavorites: false }]);
		const qb = mockQueryBuilder([noteA]);
		noteDeleteService.delete.mockResolvedValue(undefined);

		await runProcess();

		expect(qb.andWhere.mock.calls.some(args => String(args[0]).includes('note_favorite'))).toBe(false);
		expect(noteDeleteService.delete).toHaveBeenCalledTimes(1);
	});

	test('1 件の削除に失敗しても残りを継続し、成功数のみ計上する', async () => {
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder([noteA, noteB]);
		noteDeleteService.delete.mockRejectedValueOnce(new Error('delete failed'));
		noteDeleteService.delete.mockResolvedValueOnce(undefined);

		const stats = await runProcess();

		expect(noteDeleteService.delete).toHaveBeenCalledTimes(2);
		expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('note-a'));
		expect(stats).toEqual({ deletedCount: 1, processedUsers: 1 });
	});

	test('ユーザー処理中にエラーが起きても残りのユーザーの処理を継続する', async () => {
		const bob = { ...user, id: 'bob' } as unknown as MiUser;
		mockUsersRepository.findBy.mockResolvedValue([user, bob]);
		mockNotesRepository.createQueryBuilder
			.mockImplementationOnce(() => { throw new Error('query failed'); })
			.mockImplementationOnce(() => mockQueryBuilder([noteA]));
		noteDeleteService.delete.mockResolvedValue(undefined);

		const stats = await runProcess();

		expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('alice'));
		expect(stats).toEqual({ deletedCount: 1, processedUsers: 1 });
	});

	test('対象ユーザーの検索は host IS NULL (ローカルユーザー) に限定される', async () => {
		mockUsersRepository.findBy.mockResolvedValue([]);

		await runProcess();

		expect(mockUsersRepository.findBy).toHaveBeenCalledWith({
			host: IsNull(),
			autoDeleteNotesAfterDays: Not(IsNull()),
		});
	});

	test('対象ユーザーがいない場合は何もしない', async () => {
		mockUsersRepository.findBy.mockResolvedValue([]);

		const stats = await runProcess();

		expect(mockNotesRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(noteDeleteService.delete).not.toHaveBeenCalled();
		expect(stats).toEqual({ deletedCount: 0, processedUsers: 0 });
	});

	test('days が 0 以下のユーザーはスキップされる', async () => {
		mockUsersRepository.findBy.mockResolvedValue([{ ...user, autoDeleteNotesAfterDays: 0 }]);

		const stats = await runProcess();

		expect(mockNotesRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(stats).toEqual({ deletedCount: 0, processedUsers: 0 });
	});

	test('1回の実行では MAX_NOTES_PER_RUN (200件) を超えて削除しない (5件ずつ40チャンクに分けて削除)', async () => {
		const notes200 = Array.from({ length: 200 }, (_, i) => ({ id: `note-${i}`, userId: 'alice' } as MiNote));
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder(notes200);
		noteDeleteService.delete.mockResolvedValue(undefined);

		const stats = await runProcess();

		expect(stats.deletedCount).toBe(200);
		expect(mockNotesRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
		expect(noteDeleteService.delete).toHaveBeenCalledTimes(200);
		// 40チャンク分のロック延長 + 最後のロック解放1回 = 41回
		expect(mockRedisClient.eval).toHaveBeenCalledTimes(41);
	});

	test('実行中にロックの延長に失敗した場合はその時点で処理を打ち切る', async () => {
		const notes7 = Array.from({ length: 7 }, (_, i) => ({ id: `note-${i}`, userId: 'alice' } as MiNote));
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder(notes7);
		noteDeleteService.delete.mockResolvedValue(undefined);
		// 1回目の eval 呼び出し(1チャンク目の後のロック延長)だけ失敗させる
		mockRedisClient.eval.mockResolvedValueOnce(0);

		const stats = await runProcess();

		expect(noteDeleteService.delete).toHaveBeenCalledTimes(5);
		expect(stats).toEqual({ deletedCount: 5, processedUsers: 1 });
		expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Lost the auto-delete notes lock'));
	});

	test('別プロセスが実行中(ロック取得失敗)の場合は何もせずスキップする', async () => {
		mockRedisClient.set.mockResolvedValueOnce(null);

		const stats = await runProcess();

		expect(mockUsersRepository.findBy).not.toHaveBeenCalled();
		expect(stats).toEqual({ deletedCount: 0, processedUsers: 0 });
		expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('still in progress'));
	});

	test('実行後にロックを解放する(自分が取得したトークンで解放する)', async () => {
		mockUsersRepository.findBy.mockResolvedValue([]);

		await runProcess();

		expect(mockRedisClient.set).toHaveBeenCalledWith('autoDeleteNotes:lock', expect.any(String), 'PX', expect.any(Number), 'NX');
		expect(mockRedisClient.eval).toHaveBeenCalledWith(expect.any(String), 1, 'autoDeleteNotes:lock', expect.any(String));
	});
});
