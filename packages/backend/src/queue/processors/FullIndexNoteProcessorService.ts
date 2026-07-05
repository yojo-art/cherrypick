/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { AdvancedSearchService } from '@/core/AdvancedSearchService.js';
import { bindThis } from '@/decorators.js';
import type * as Bull from 'bullmq';

const FULL_INDEX_MAX_DURATION_MIN = 120;

@Injectable()
export class FullIndexNoteProcessorService {
	constructor(
		private advancedSearchService: AdvancedSearchService,
	) {}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		await this.advancedSearchService.fullIndexNote(FULL_INDEX_MAX_DURATION_MIN);
	}
}
