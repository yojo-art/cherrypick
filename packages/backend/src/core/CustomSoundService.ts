/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { CustomSoundsRepository, MiCustomSound } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class CustomSoundService {
	constructor(
		@Inject(DI.customSoundsRepository)
		private customSoundsRepository: CustomSoundsRepository,

		private idService: IdService,
	) { }

	@bindThis
	public async getAll(): Promise<MiCustomSound[]> {
		return this.customSoundsRepository.find();
	}

	@bindThis
	public async findOneById(id: MiCustomSound['id']): Promise<MiCustomSound | null> {
		return this.customSoundsRepository.findOneBy({ id });
	}

	@bindThis
	public async create(options: {
		name: string;
		url: string;
		fileId: string;
	}): Promise<MiCustomSound> {
		return this.customSoundsRepository.insertOne({
			id: this.idService.gen(),
			updatedAt: null,
			name: options.name,
			url: options.url,
			fileId: options.fileId,
		});
	}

	@bindThis
	public async delete(id: MiCustomSound['id']): Promise<void> {
		await this.customSoundsRepository.delete({ id });
	}
}
