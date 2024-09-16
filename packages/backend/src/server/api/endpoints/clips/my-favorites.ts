/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ClipFavoritesRemoteRepository, ClipFavoritesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipService } from '@/core/ClipService.js';
import { Packed } from '@/misc/json-schema.js';

export const meta = {
	tags: ['account', 'clip'],

	requireCredential: true,

	kind: 'read:clip-favorite',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Clip',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		withLocal: { type: 'boolean', default: true },
		withRemote: { type: 'boolean', default: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.clipFavoritesRepository)
		private clipFavoritesRepository: ClipFavoritesRepository,
		@Inject(DI.clipFavoritesRemoteRepository)
		private clipFavoritesRemoteRepository: ClipFavoritesRemoteRepository,

		private clipService: ClipService,
		private clipEntityService: ClipEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let myFavorites: Packed<'Clip'>[] = [];
			if (ps.withLocal) {
				const query = this.clipFavoritesRepository.createQueryBuilder('favorite')
					.andWhere('favorite.userId = :meId', { meId: me.id })
					.leftJoinAndSelect('favorite.clip', 'clip');

				const favorites = await query
					.getMany();
				const localFavorites = await this.clipEntityService.packMany(favorites.map(x => x.clip!), me);
				myFavorites = myFavorites.concat(localFavorites);
			}
			if (ps.withRemote) {
				const query = this.clipFavoritesRemoteRepository.createQueryBuilder('favorite')
					.andWhere('favorite.userId = :meId', { meId: me.id })
					.leftJoinAndSelect('like.author', 'author');

				const favorites = await query.getMany();
				const remoteFavorites = await Promise.all(favorites.map(e => clipService.showRemoteOrDummy(e.clipId, e.author)));
				myFavorites = myFavorites.concat(remoteFavorites);
			}
			return myFavorites.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
		});
	}
}
