/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { FlashLikesRemoteRepository, FlashsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import { DI } from '@/di-symbols.js';
import { FlashService } from '@/core/FlashService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['flashs'],

	requireCredential: false,

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Flash',
	},

	errors: {
		noSuchFlash: {
			message: 'No such flash.',
			code: 'NO_SUCH_FLASH',
			id: 'f0d34a1a-d29a-401d-90ba-1982122b5630',
		},
		invalidIdFormat: {
			message: 'Invalid id format.',
			code: 'INVALID_ID_FORMAT',
			id: 'df45c7d1-cd15-4a35-b3e1-8c9f987c4f5c',
		},
		failedToResolveRemoteUser: {
			message: 'failedToResolveRemoteUser.',
			code: 'FAILED_TO_RESOLVE_REMOTE_USER',
			id: '56d5e552-d55a-47e3-9f37-6dc85a93ecf9',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		flashId: { type: 'string' },
	},
	required: ['flashId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,
		@Inject(DI.flashLikesRemoteRepository)
		private flashLikesRemoteRepository: FlashLikesRemoteRepository,

		private flashService: FlashService,
		private flashEntityService: FlashEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const parsed_id = ps.flashId.split('@');
			if (parsed_id.length === 2 ) {//is remote
				const flash = await flashService.showRemote(parsed_id[0], parsed_id[1], true).catch(err => {
					throw new ApiError(meta.errors.failedToResolveRemoteUser);
				});

				if (me) {
					const exist = await this.flashLikesRemoteRepository.exists({
						where: {
							flashId: parsed_id[0],
							host: parsed_id[1],
							userId: me.id,
						},
					});
					if (exist) {
						flash.isLiked = true;
					}
				}
				return flash;
			}
			if (parsed_id.length !== 1 ) {//is not local
				throw new ApiError(meta.errors.invalidIdFormat);
			}
			const flash = await this.flashsRepository.findOneBy({ id: ps.flashId });

			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}

			return await this.flashEntityService.pack(flash, me);
		});
	}
}
