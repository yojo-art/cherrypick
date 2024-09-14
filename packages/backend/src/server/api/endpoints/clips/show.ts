/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import got, * as Got from 'got';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ClipsRepository } from '@/models/_.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import { ClipService } from '@/core/ClipService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['clips', 'account'],

	requireCredential: false,

	kind: 'read:account',

	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: 'c3c5fe33-d62c-44d2-9ea5-d997703f5c20',
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

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Clip',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		clipId: { type: 'string' },
	},
	required: ['clipId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		private clipService: ClipService,
		private clipEntityService: ClipEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const parsed_id = ps.clipId.split('@');
			if (parsed_id.length === 2 ) {//is remote
				return clipService.showRemote(parsed_id[0], parsed_id[1]).catch(err => {
					throw new ApiError(meta.errors.failedToResolveRemoteUser);
				});
			}
			if (parsed_id.length !== 1 ) {//is not local
				throw new ApiError(meta.errors.invalidIdFormat);
			}
			// Fetch the clip
			const clip = await this.clipsRepository.findOneBy({
				id: ps.clipId,
			});

			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			if (!clip.isPublic && (me == null || (clip.userId !== me.id))) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			return await this.clipEntityService.pack(clip, me);
		});
	}
}

