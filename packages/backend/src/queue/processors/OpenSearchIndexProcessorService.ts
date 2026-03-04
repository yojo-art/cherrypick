/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import * as Bull from 'bullmq';
import type { NotesRepository, PollsRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { AdvancedSearchService } from '@/core/AdvancedSearchService.js';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type { OpenSerchIndexJobData } from '../types.js';

// TODO: 名前衝突時の動作を選べるようにする
@Injectable()
export class OpenSearchIndexProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		private advancedSearchService: AdvancedSearchService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('import-custom-emojis');
	}

	@bindThis
	public async process(job: Bull.Job<OpenSerchIndexJobData>): Promise<void> {
		switch (job.data.type) {
			case 'note':
			{
				const note = await this.notesRepository
					.createQueryBuilder('note')
					.leftJoin('note.renote', 'renote')
					.select(['note'])
					.where('note.id > :targetId', { targetId: job.data.untilId })
					.andWhere(new Brackets( qb => {
						qb.where('note."userHost" IS NULL')
							.orWhere(new Brackets(qb2 => {
								qb2
									.where('note."userHost" IS NOT NULL')
									.andWhere('note."searchableBy" != \'private\'')
									.orWhere('note."searchableBy" IS NULL');
							}));
					}))
					.orderBy('note.id', 'ASC')
					.getOne();
				if (!note) return;
				if (note.hasPoll) {
					const poll = await this.notesRepository.manager.getRepository('poll').findOneBy({ noteId: note.id });
					await this.advancedSearchService.indexNote(note, poll ? poll.choices : undefined);
				} else await this.pollsRepository.findOneBy({ noteId: note.id });
				break; }

			case 'noteAll':
				await this.advancedSearchService.bulkIndexNote(job.data.untilId, job.data.limitId);
				break;
			default:
				throw new Bull.UnrecoverableError(`Unknown import type: ${job.data.type}`);
		}
	}
}
