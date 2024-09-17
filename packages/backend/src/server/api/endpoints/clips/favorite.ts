/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ClipsRepository, ClipFavoritesRepository, ClipFavoritesRemoteRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ClipService } from '@/core/ClipService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['clip'],

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:clip-favorite',

	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: '4c2aaeae-80d8-4250-9606-26cb1fdb77a5',
		},

		alreadyFavorited: {
			message: 'The clip has already been favorited.',
			code: 'ALREADY_FAVORITED',
			id: '92658936-c625-4273-8326-2d790129256e',
		},
		unimplemented: {
			message: 'Unimplemented.',
			code: 'UNIMPLEMENTED',
			id: '37561aed-4ba4-4a53-9efe-a0aa255e9bb3',
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
		clipId: { type: 'string' },
	},
	required: ['clipId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		@Inject(DI.clipFavoritesRepository)
		private clipFavoritesRepository: ClipFavoritesRepository,
		@Inject(DI.clipFavoritesRemoteRepository)
		private clipFavoritesRemoteRepository: ClipFavoritesRemoteRepository,

		private clipService: ClipService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const clipIdArray = ps.clipId.split('@');
			if (clipIdArray.length > 2) {
				throw new ApiError(meta.errors.unimplemented);
			}
			const host = clipIdArray.length > 1 ? clipIdArray[1] : null;
			if (host) {
				const clipId = clipIdArray[0];
				const clip = await clipService.showRemote(clipId, host);

				const exist = await this.clipFavoritesRemoteRepository.exists({
					where: {
						clipId: clipId,
						host: host,
						userId: me.id,
					},
				});

				if (exist) {
					throw new ApiError(meta.errors.alreadyFavorited);
				}

				await this.clipFavoritesRemoteRepository.insert({
					id: this.idService.gen(),
					clipId: clipId,
					host: host,
					userId: me.id,
					authorId: clip.userId,
				});
				return;
			}
			const clip = await this.clipsRepository.findOneBy({ id: ps.clipId });
			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}
			if ((clip.userId !== me.id) && !clip.isPublic) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			const exist = await this.clipFavoritesRepository.exists({
				where: {
					clipId: clip.id,
					userId: me.id,
				},
			});

			if (exist) {
				throw new ApiError(meta.errors.alreadyFavorited);
			}

			await this.clipFavoritesRepository.insert({
				id: this.idService.gen(),
				clipId: clip.id,
				userId: me.id,
			});
		});
	}
}
