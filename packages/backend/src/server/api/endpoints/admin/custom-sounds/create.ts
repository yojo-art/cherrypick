/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import type { DriveFilesRepository } from '@/models/_.js';
import { CustomSoundService } from '@/core/CustomSoundService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requiredRolePolicy: 'canManageCustomSounds',
	kind: 'write:admin:custom-sounds',

	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'd96a6683-be10-4c7a-9a3a-93b1c2f1ac8b',
		},
		unsupportedFileType: {
			message: 'Unsupported file type.',
			code: 'UNSUPPORTED_FILE_TYPE',
			id: 'd1a16b90-6cdc-49f2-a191-cc2204d2049a',
		},
		fileAlreadyUsed: {
			message: 'This file is already used by another sound.',
			code: 'FILE_ALREADY_USED',
			id: '5db26a76-89e1-41f1-9d7d-c435c020f231',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			id: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			name: {
				type: 'string',
				optional: false, nullable: false,
			},
			url: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 256 },
		fileId: { type: 'string', format: 'misskey:id' },
	},
	required: ['name', 'fileId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private customSoundService: CustomSoundService,
	) {
		super(meta, paramDef, async (ps) => {
			const driveFile = await this.driveFilesRepository.findOneBy({ id: ps.fileId });
			if (driveFile == null) throw new ApiError(meta.errors.noSuchFile);
			if (!driveFile.type.startsWith('audio')) throw new ApiError(meta.errors.unsupportedFileType);

			const existing = await this.customSoundService.findOneByFileId(ps.fileId);
			if (existing != null) throw new ApiError(meta.errors.fileAlreadyUsed);

			try {
				const sound = await this.customSoundService.create({
					name: ps.name,
					fileId: driveFile.id,
				});

				return await this.customSoundService.pack(sound);
			} catch (e) {
				if (isDuplicateKeyValueError(e)) {
					throw new ApiError(meta.errors.fileAlreadyUsed);
				}
				throw e;
			}
		});
	}
}
