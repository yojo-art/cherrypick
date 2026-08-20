/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { CustomSoundsRepository, DriveFilesRepository, MiCustomSound } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';

export type CustomSoundPacked = {
	id: MiCustomSound['id'];
	name: string;
	driveFile: string | null;
	url: string | null;
};

@Injectable()
export class CustomSoundService {
	constructor(
		@Inject(DI.customSoundsRepository)
		private customSoundsRepository: CustomSoundsRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

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
		fileId: string;
	}): Promise<MiCustomSound> {
		return this.customSoundsRepository.insertOne({
			id: this.idService.gen(),
			updatedAt: null,
			name: options.name,
			fileId: options.fileId,
		});
	}

	@bindThis
	public async delete(id: MiCustomSound['id']): Promise<void> {
		await this.customSoundsRepository.delete({ id });
	}

	@bindThis
	public async pack(sound: MiCustomSound): Promise<CustomSoundPacked> {
		const file = sound.fileId != null ? await this.driveFilesRepository.findOneBy({ id: sound.fileId }) : null;

		return {
			id: sound.id,
			name: sound.name,
			driveFile: sound.fileId,
			url: file != null ? (file.webpublicUrl ?? file.url) : null,
		};
	}

	@bindThis
	public async packMany(sounds: MiCustomSound[]): Promise<CustomSoundPacked[]> {
		const fileIds = [...new Set(sounds.map(sound => sound.fileId).filter((id): id is string => id != null))];
		const files = fileIds.length > 0 ? await this.driveFilesRepository.findBy({ id: In(fileIds) }) : [];
		const fileMap = new Map(files.map(file => [file.id, file]));

		return sounds.map(sound => {
			const file = sound.fileId != null ? (fileMap.get(sound.fileId) ?? null) : null;
			return {
				id: sound.id,
				name: sound.name,
				driveFile: sound.fileId,
				url: file != null ? (file.webpublicUrl ?? file.url) : null,
			};
		});
	}
}
