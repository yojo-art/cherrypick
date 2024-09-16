/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FlashLikesRemoteRepository, FlashLikesRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { FlashLikeEntityService } from '@/core/entities/FlashLikeEntityService.js';
import { DI } from '@/di-symbols.js';
import { Packed } from '@/misc/json-schema.js';
import { FlashService } from '@/core/FlashService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { IdService } from '@/core/IdService.js';

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
		sinceId: { type: 'string' },
		untilId: { type: 'string' },
		withLocal: { type: 'boolean', default: true },
		withRemote: { type: 'boolean', default: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.flashLikesRepository)
		private flashLikesRepository: FlashLikesRepository,
		@Inject(DI.flashLikesRemoteRepository)
		private flashLikesRemoteRepository: FlashLikesRemoteRepository,

		private flashLikeEntityService: FlashLikeEntityService,
		private flashService: FlashService,
		private queryService: QueryService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let myFavorites: {id:string, flash:Packed<'Flash'>}[] = [];

			//sinceId/untilIdがローカル形式とは限らないから推測して時刻に変換する
			function tryParse(id?:string):number|undefined {
				if (!id) return undefined;
				const idArray = id.split('@');
				if (idArray.length === 1 ) {
					//ローカル
					return idService.parse(id).date.getTime();
				}
				if (idArray.length === 2 ) {
					//リモート
					return idService.tryParse(idArray[0]).date.getTime();
				}
				//謎
				return undefined;
			}

			const sinceDate = tryParse(ps.sinceId);
			const untilDate = tryParse(ps.untilId);
			if (ps.withLocal) {
				const query = this.queryService.makePaginationQuery(this.flashLikesRepository.createQueryBuilder('like'), undefined, undefined, sinceDate, untilDate)
					.andWhere('like.userId = :meId', { meId: me.id })
					.leftJoinAndSelect('like.flash', 'flash');

				const likes = await query
					.limit(ps.limit)
					.getMany();
				myFavorites = myFavorites.concat(await this.flashLikeEntityService.packMany(likes, me));
			}
			if (ps.withRemote) {
				const query = this.queryService.makePaginationQuery(this.flashLikesRemoteRepository.createQueryBuilder('like'), undefined, undefined, sinceDate, untilDate)
					.andWhere('like.userId = :meId', { meId: me.id });

				const likes = await query
					.limit(ps.limit)
					.getMany();
				const remoteLikes = await Promise.all(likes.map(e => awaitAll({ id: e.id, flash: flashService.showRemote(e.flashId, e.host) })));
				myFavorites = myFavorites.concat(remoteLikes);
			}
			return myFavorites.sort((a, b) => new Date(a.flash.createdAt).getTime() - new Date(b.flash.createdAt).getTime());
		});
	}
}

