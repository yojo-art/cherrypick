/*
 * SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { DB_MAX_IMAGE_COMMENT_LENGTH } from '@/const.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import { DriveService } from '@/core/DriveService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['drive'],

	requireCredential: true,

	prohibitMoved: true,

	limit: {
		duration: ms('1hour'),
		max: 120,
	},

	kind: 'write:drive',

	description: 'Upload a new drive file.',

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'DriveFile',
	},

	errors: {
		invalidFileName: {
			message: 'Invalid file name.',
			code: 'INVALID_FILE_NAME',
			id: 'f449b209-0c60-4e51-84d5-29486263bfd4',
		},

		inappropriate: {
			message: 'Cannot upload the file because it has been determined that it possibly contains inappropriate content.',
			code: 'INAPPROPRIATE',
			id: 'bec5bd69-fba3-43c9-b4fb-2894b66ad5d2',
		},

		noFreeSpace: {
			message: 'Cannot upload the file because you have no free space of drive.',
			code: 'NO_FREE_SPACE',
			id: 'd08dbc37-a6a9-463a-8c47-96c32ab5f064',
		},
		invalidFileSize: {
			message: 'File size exceeds limit.',
			code: 'INVALID_FILE_SIZE',
			id: '9068668f-0465-4c0e-8341-1c52fd6f5ab3',
		},
		badGateway: {
			message: 'Bad Gateway.',
			code: 'BAD_GATEWAY',
			id: '91174406-bae7-40b6-a453-3e0cd21af342',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		upload_service_key: { type: 'string', nullable: false },
		baseUrl: { type: 'string', nullable: false },
		accessKey: { type: 'string', nullable: false },
		thumbnailKey: { type: 'string', nullable: true, default: null },
		md5: { type: 'string', nullable: false },
		blurhash: { type: 'string', default: null, nullable: true },
		size: { type: 'number', default: 0 },
		width: { type: 'number', default: 0 },
		height: { type: 'number', default: 0 },
		sourceUrl: { type: 'string', nullable: true, default: null },
		remoteUri: { type: 'string', nullable: true, default: null },
		isLink: { type: 'boolean', default: false },
		folderId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
		name: { type: 'string', nullable: false },
		comment: { type: 'string', nullable: true, maxLength: DB_MAX_IMAGE_COMMENT_LENGTH, default: null },
		isSensitive: { type: 'boolean', default: false },
		maybeSensitive: { type: 'boolean', default: false },
		contentType: { type: 'string', nullable: false },
		force: { type: 'boolean', default: false },
	},
	required: ['upload_service_key', 'baseUrl', 'accessKey', 'md5', 'name', 'contentType'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,

		private driveFileEntityService: DriveFileEntityService,
		private metaService: MetaService,
		private driveService: DriveService,
	) {
		super(meta, paramDef, async (ps, me, _1, _2, _file, cleanup, ip, headers) => {
			if (ps.upload_service_key !== config.upload_service_key) throw new ApiError(meta.errors.badGateway);

			//const instance = await this.metaService.fetch();
			//instance.sensitiveMediaDetectionSensitivity

			let name = ps.name;
			name = name.trim();
			if (name.length === 0) {
				throw new ApiError(meta.errors.invalidFileName);
			} else if (!this.driveFileEntityService.validateFileName(name)) {
				throw new ApiError(meta.errors.invalidFileName);
			}

			try {
				// Create file
				const instance = await this.metaService.fetch();
				const driveFile = await this.driveService.registerFile({
					user: me,
					baseUrl: ps.baseUrl,
					thumbnailKey: ps.thumbnailKey,
					accessKey: ps.accessKey,
					detectedName: name,
					comment: ps.comment,
					folderId: ps.folderId,
					force: ps.force,
					sensitive: ps.isSensitive,
					requestIp: instance.enableIpLogging ? ip ? ip : null : null,
					requestHeaders: instance.enableIpLogging ? headers ? headers : null : null,
					url: ps.sourceUrl,
					uri: ps.remoteUri,
					md5: ps.md5,
					isLink: ps.isLink,
					blurhash: ps.blurhash,
					size: ps.size,
					width: ps.width,
					height: ps.height,
					maybeSensitive: ps.maybeSensitive,
					contentType: ps.contentType,
				});
				return await this.driveFileEntityService.pack(driveFile, { self: true });
			} catch (err) {
				if (err instanceof Error || typeof err === 'string') {
					console.error(err);
				}
				if (err instanceof IdentifiableError) {
					if (err.id === '282f77bf-5816-4f72-9264-aa14d8261a21') throw new ApiError(meta.errors.inappropriate);
					if (err.id === 'c6244ed2-a39a-4e1c-bf93-f0fbd7764fa6') throw new ApiError(meta.errors.noFreeSpace);
					if (err.id === 'e5989b6d-ae66-49ed-88af-516ded10ca0c') throw new ApiError(meta.errors.invalidFileSize);
				}
				throw new ApiError();
			} finally {
				if (cleanup)cleanup();
			}
		});
	}
}
