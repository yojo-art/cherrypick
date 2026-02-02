/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FlashLikeEntityService } from '@/core/entities/FlashLikeEntityService.js';
import { Packed } from '@/misc/json-schema.js';
import { FlashService } from '@/core/FlashService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';

export const meta = {
	tags: ['account', 'flash'],

	requireCredential: true,

	kind: 'read:flash-likes',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
				},
				flash: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'Flash',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		search: { type: 'string', minLength: 1, maxLength: 100, nullable: true },
		withLocal: { type: 'boolean', default: true },
		withRemote: { type: 'boolean', default: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private flashLikeEntityService: FlashLikeEntityService,
		private flashService: FlashService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let myFavorites: { id: string, flash: Packed<'Flash'> }[] = [];

			if (ps.withLocal) {
				const likes = await this.flashService.myLikesLocal(me.id, {
					sinceId: ps.sinceId,
					untilId: ps.untilId,
					sinceDate: ps.sinceDate,
					untilDate: ps.untilDate,
					limit: ps.limit,
					search: ps.search,
				});
				myFavorites = myFavorites.concat(await this.flashLikeEntityService.packMany(likes, me));
			}

			if (ps.withRemote) {
				const likes = await this.flashService.myLikesRemote(me.id, {
					sinceId: ps.sinceId,
					untilId: ps.untilId,
					sinceDate: ps.sinceDate,
					untilDate: ps.untilDate,
					limit: ps.limit,
					search: ps.search,
				});
				let remoteLikes = await Promise.all(likes.map(e => awaitAll({ id: e.id, flash: this.flashService.showRemoteOrDummy(e.flashId, e.author, true) })));
				remoteLikes = remoteLikes.map(flash => {
					flash.flash.isLiked = true;
					return flash;
				});
				myFavorites = myFavorites.concat(remoteLikes);
			}
			return myFavorites.sort((a, b) => new Date(a.flash.createdAt).getTime() - new Date(b.flash.createdAt).getTime());
		});
	}
}

