/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';
import type { DriveFilesRepository } from '@/models/_.js';
import { CustomSoundService } from '@/core/CustomSoundService.js';
import { DriveService } from '@/core/DriveService.js';
import { InternalStorageService } from '@/core/InternalStorageService.js';
import type { MiCustomSound } from '@/models/CustomSound.js';
import type { MiDriveFile } from '@/models/DriveFile.js';

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
			driveFile: {
				type: 'string',
				optional: false, nullable: true,
				format: 'id',
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

		private driveService: DriveService,

		private internalStorageService: InternalStorageService,

		private customSoundService: CustomSoundService,
	) {
		super(meta, paramDef, async (ps) => {
			const driveFile = await this.driveFilesRepository.findOneBy({ id: ps.fileId });
			if (driveFile == null) throw new ApiError(meta.errors.noSuchFile);
			if (!driveFile.type.startsWith('audio')) throw new ApiError(meta.errors.unsupportedFileType);

			// システムユーザーとして再アップロードし、登録したユーザーのドライブファイルに依存しないようにする
			// 内部ストレージのファイルはローカルでコピーし、それ以外は HTTP で再取得する
			let systemFile: MiDriveFile;
			if (driveFile.storedInternal && driveFile.accessKey != null) {
				systemFile = await this.driveService.addFile({
					user: null,
					path: this.internalStorageService.resolvePath(driveFile.accessKey),
					name: driveFile.name,
					force: true,
					url: driveFile.url,
					uri: driveFile.uri,
				});
			} else {
				systemFile = await this.driveService.uploadFromUrl({
					url: driveFile.url,
					user: null,
					force: true,
				});
			}

			// 再アップロード後の実際のコンテンツに対して再度判定する
			if (!systemFile.type.startsWith('audio')) {
				await this.driveService.deleteFile(systemFile);
				throw new ApiError(meta.errors.unsupportedFileType);
			}

			let sound: MiCustomSound;
			try {
				sound = await this.customSoundService.create({
					name: ps.name,
					fileId: systemFile.id,
				});
			} catch (err) {
				await this.driveService.deleteFile(systemFile);
				throw err;
			}

			return await this.customSoundService.pack(sound);
		});
	}
}
