/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'vitest-mock-extended';
import type { TestingModule } from '@nestjs/testing';
import { AutoDeleteNotesProcessorService } from '@/queue/processors/AutoDeleteNotesProcessorService.js';
import { IdService } from '@/core/IdService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import { DI } from '@/di-symbols.js';
import type { MiNote } from '@/models/Note.js';
import type { MiUser } from '@/models/User.js';

describe('AutoDeleteNotesProcessorService', () => {
	let app: TestingModule;
	let service: AutoDeleteNotesProcessorService;
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
			select: vi.fn().mockReturnThis(),
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

	test('SUB_BATCH_SIZE (5件) 以下ならまとめて1回で削除される', async () => {
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder([noteA, noteB]);

		const stats = await runProcess();

		expect(mockNotesRepository.delete).toHaveBeenCalledTimes(1);
		expect(mockNotesRepository.delete).toHaveBeenCalledWith(['note-a', 'note-b']);
		expect(stats).toEqual({ deletedCount: 2, processedUsers: 1 });
	});

	test('SUB_BATCH_SIZE (5件) を超える分は複数回に分けて削除される', async () => {
		const notes7 = Array.from({ length: 7 }, (_, i) => ({ id: `note-${i}`, userId: 'alice' } as MiNote));
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder(notes7);

		const stats = await runProcess();

		expect(mockNotesRepository.delete).toHaveBeenCalledTimes(2);
		expect(mockNotesRepository.delete).toHaveBeenNthCalledWith(1, notes7.slice(0, 5).map(n => n.id));
		expect(mockNotesRepository.delete).toHaveBeenNthCalledWith(2, notes7.slice(5).map(n => n.id));
		expect(stats).toEqual({ deletedCount: 7, processedUsers: 1 });
	});

	test('削除対象は note.id 昇順(古い順)で取得する', async () => {
		mockUsersRepository.findBy.mockResolvedValue([user]);
		const qb = mockQueryBuilder([noteA]);

		await runProcess();

		expect(qb.orderBy).toHaveBeenCalledWith('note.id', 'ASC');
	});

	test('autoDeleteKeepFavorites が有効な場合は favorite を除外する条件が付く', async () => {
		mockUsersRepository.findBy.mockResolvedValue([{ ...user, autoDeleteKeepFavorites: true }]);
		const qb = mockQueryBuilder([noteA]);

		await runProcess();

		expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('note_favorite'));
	});

	test('autoDeleteKeepFavorites が無効な場合は除外条件が付かない', async () => {
		mockUsersRepository.findBy.mockResolvedValue([{ ...user, autoDeleteKeepFavorites: false }]);
		const qb = mockQueryBuilder([noteA]);

		await runProcess();

		expect(qb.andWhere.mock.calls.some(args => String(args[0]).includes('note_favorite'))).toBe(false);
	});

	test('ユーザー処理中にエラーが起きても残りのユーザーの処理を継続する', async () => {
		const bob = { ...user, id: 'bob' } as unknown as MiUser;
		mockUsersRepository.findBy.mockResolvedValue([user, bob]);
		mockNotesRepository.createQueryBuilder
			.mockImplementationOnce(() => { throw new Error('query failed'); })
			.mockImplementationOnce(() => mockQueryBuilder([noteA]));

		const stats = await runProcess();

		expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('alice'));
		expect(stats).toEqual({ deletedCount: 1, processedUsers: 1 });
	});

	test('対象ユーザーがいない場合は何もしない', async () => {
		mockUsersRepository.findBy.mockResolvedValue([]);

		const stats = await runProcess();

		expect(mockNotesRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(stats).toEqual({ deletedCount: 0, processedUsers: 0 });
	});

	test('days が 0 以下のユーザーはスキップされる', async () => {
		mockUsersRepository.findBy.mockResolvedValue([{ ...user, autoDeleteNotesAfterDays: 0 }]);

		const stats = await runProcess();

		expect(mockNotesRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(stats).toEqual({ deletedCount: 0, processedUsers: 0 });
	});

	test('1回の実行では MAX_NOTES_PER_RUN (200件) を超えて削除しない (5件ずつ40回に分けて削除)', async () => {
		const notes200 = Array.from({ length: 200 }, (_, i) => ({ id: `note-${i}`, userId: 'alice' } as MiNote));
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder(notes200);

		const stats = await runProcess();

		expect(stats.deletedCount).toBe(200);
		expect(mockNotesRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
		expect(mockNotesRepository.delete).toHaveBeenCalledTimes(40);
	});

	test('実行中にロックの延長に失敗した場合はその時点で処理を打ち切る', async () => {
		const notes7 = Array.from({ length: 7 }, (_, i) => ({ id: `note-${i}`, userId: 'alice' } as MiNote));
		mockUsersRepository.findBy.mockResolvedValue([user]);
		mockQueryBuilder(notes7);
		// 1回目の eval 呼び出し(1チャンク目の後のロック延長)だけ失敗させる
		mockRedisClient.eval.mockResolvedValueOnce(0);

		const stats = await runProcess();

		expect(mockNotesRepository.delete).toHaveBeenCalledTimes(1);
		expect(mockNotesRepository.delete).toHaveBeenCalledWith(notes7.slice(0, 5).map(n => n.id));
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
