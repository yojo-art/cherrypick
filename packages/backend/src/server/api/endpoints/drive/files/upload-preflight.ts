/*
 * SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { DriveFilesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { DriveService } from '@/core/DriveService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['drive'],

	requireCredential: true,

	kind: 'write:drive',

	description: 'Update the properties of a drive file.',

	errors: {
		invalidFileName: {
			message: 'Invalid file name.',
			code: 'INVALID_FILE_NAME',
			id: '395e7156-f9f0-475e-af89-53c3c23080c2',
		},

		noSuchFolder: {
			message: 'No such folder.',
			code: 'NO_SUCH_FOLDER',
			id: 'ea8fb7a5-af77-4a08-b608-c0218176cd73',
		},

		restrictedByRole: {
			message: 'This feature is restricted by your role.',
			code: 'RESTRICTED_BY_ROLE',
			id: '7f59dccb-f465-75ab-5cf4-3ce44e3282f7',
		},
		badGateway: {
			message: 'Bad Gateway.',
			code: 'BAD_GATEWAY',
			id: '91174406-bae7-40b6-a453-3e0cd21af342',
		},
	},
	res: {
		type: 'object',
		optional: false, nullable: false,
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		upload_service_key: { type: 'string', nullable: false },
		folderId: { type: 'string', format: 'misskey:id', default: null, nullable: true },
		name: { type: 'string', default: null },
		comment: { type: 'string', default: null, nullable: true, maxLength: 512 },
		size: { type: 'number', default: 0, nullable: false },
		ext: { type: 'string', default: null, nullable: true },
		isLink: { type: 'boolean', default: false },
		url: { type: 'string', default: null, nullable: true },
		uri: { type: 'string', default: null, nullable: true },
	},
	required: ['upload_service_key'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private driveService: DriveService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.upload_service_key !== config.upload_service_key) throw new ApiError(meta.errors.badGateway);
			try {
				return await this.driveService.registerPreflight({
					user: me,
					folderId: ps.folderId,
					name: ps.name,
					comment: ps.comment,
					url: ps.url,
					uri: ps.uri,
					isLink: ps.isLink,
					size: ps.size,
					ext: ps.ext,
				});
			} catch (e) {
				if (e instanceof DriveService.InvalidFileNameError) {
					throw new ApiError(meta.errors.invalidFileName);
				} else if (e instanceof DriveService.NoSuchFolderError) {
					throw new ApiError(meta.errors.noSuchFolder);
				} else {
					throw e;
				}
			}
		});
	}
}
