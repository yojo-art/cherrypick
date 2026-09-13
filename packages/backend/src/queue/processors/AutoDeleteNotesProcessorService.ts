/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { IsNull, Not } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { NotesRepository, UsersRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

// 一度の実行(cronの1tick)で削除するノート数の上限。実行頻度を上げつつ1回あたりの
// 削除件数・トランザクションサイズを抑える設計にしている(cronは10分おき)。
const MAX_NOTES_PER_RUN = 200;
// 1回の DELETE 文で処理する件数。MAX_NOTES_PER_RUN 分を一括で消すのではなく
// 小分けにし、間に間隔を空けることで削除がパルス的に集中しないようにする。
const SUB_BATCH_SIZE = 5;
const SUB_BATCH_INTERVAL_MS = 1000;
// 実行中フラグの Redis ロックキー / TTL。実行間隔(10分)より十分短く、かつ
// プロセスがクラッシュしてロック解放できなくても自動的に開放されるようにする。
const LOCK_KEY = 'autoDeleteNotes:lock';
const LOCK_TTL_MS = 5 * 60 * 1000;
const RELEASE_LOCK_SCRIPT = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

@Injectable()
export class AutoDeleteNotesProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private idService: IdService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('auto-delete-notes');
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<{
		deletedCount: number;
		processedUsers: number;
	}> {
		// cluster (複数ワーカープロセス) 環境では同じ system キューを複数プロセスが
		// 処理し得るため、in-memory なフラグではなく Redis ロックで前回実行中の
		// 重複起動を防ぐ。
		const lockToken = randomUUID();
		const acquired = await this.redisClient.set(LOCK_KEY, lockToken, 'PX', LOCK_TTL_MS, 'NX');

		if (acquired !== 'OK') {
			this.logger.info('Previous auto-delete notes run is still in progress. Skipping this tick.');
			return { deletedCount: 0, processedUsers: 0 };
		}

		try {
			return await this.processWithLock();
		} finally {
			await this.redisClient.eval(RELEASE_LOCK_SCRIPT, 1, LOCK_KEY, lockToken);
		}
	}

	@bindThis
	private async processWithLock(): Promise<{
		deletedCount: number;
		processedUsers: number;
	}> {
		this.logger.info('Starting auto-delete notes process...');

		const stats = {
			deletedCount: 0,
			processedUsers: 0,
		};

		// autoDeleteNotesAfterDays가 설정된 유저 찾기
		const usersWithAutoDelete = await this.usersRepository.findBy({
			autoDeleteNotesAfterDays: Not(IsNull()),
		});

		if (usersWithAutoDelete.length === 0) {
			this.logger.info('No users with auto-delete settings found.');
			return stats;
		}

		this.logger.info(`Found ${usersWithAutoDelete.length} users with auto-delete settings.`);

		// 각 유저별로 처리 (1回の実行あたり MAX_NOTES_PER_RUN 件に達したら打ち切り、
		// 続きは次回の実行(10分後)に持ち越す)
		for (const user of usersWithAutoDelete) {
			if (stats.deletedCount >= MAX_NOTES_PER_RUN) break;

			try {
				const days = user.autoDeleteNotesAfterDays;
				if (days === null || days <= 0) continue;

				// 삭제 기준 날짜 계산
				const deleteBeforeDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
				const deleteBeforeId = this.idService.gen(deleteBeforeDate.getTime());

				this.logger.info(`Processing user ${user.id}: deleting notes older than ${days} days (before ${deleteBeforeDate.toISOString()})`);

				// 삭제할 노트 찾기 (古いノートから優先的に削除する)
				const queryBuilder = this.notesRepository.createQueryBuilder('note')
					.where('note.userId = :userId', { userId: user.id })
					.andWhere('note.id < :deleteBeforeId', { deleteBeforeId });

				// 즐겨찾기 보호 설정이 켜져 있으면 즐겨찾기된 노트 제외
				if (user.autoDeleteKeepFavorites) {
					queryBuilder.andWhere('NOT EXISTS (SELECT 1 FROM note_favorite WHERE "noteId" = note.id)');
				}

				const notesToDelete = await queryBuilder
					.select('note.id')
					.orderBy('note.id', 'ASC')
					.limit(MAX_NOTES_PER_RUN - stats.deletedCount)
					.getMany();

				if (notesToDelete.length > 0) {
					const noteIds = notesToDelete.map(note => note.id);

					// SUB_BATCH_SIZE 件ずつに分けて削除し、間に間隔を空けることで
					// 一度に大量のDELETE(とそれに伴うカスケード削除)が集中しないようにする
					for (let i = 0; i < noteIds.length; i += SUB_BATCH_SIZE) {
						const chunk = noteIds.slice(i, i + SUB_BATCH_SIZE);
						await this.notesRepository.delete(chunk);
						stats.deletedCount += chunk.length;

						if (i + SUB_BATCH_SIZE < noteIds.length) {
							await sleep(SUB_BATCH_INTERVAL_MS);
						}
					}

					this.logger.info(`Deleted ${noteIds.length} notes for user ${user.id}`);
				} else {
					this.logger.info(`No notes to delete for user ${user.id}`);
				}

				stats.processedUsers++;
			} catch (error) {
				this.logger.error(`Error processing user ${user.id}: ${error}`);
				// 한 유저의 에러가 전체 프로세스를 막지 않도록 계속 진행
			}
		}

		this.logger.succ(`Auto-delete notes process completed. Processed ${stats.processedUsers} users, deleted ${stats.deletedCount} notes.`);

		return stats;
	}
}
