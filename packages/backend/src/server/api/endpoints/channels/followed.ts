/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FollowingsRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';

export const meta = {
	tags: ['channels', 'account'],

	requireCredential: true,

	kind: 'read:channels',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Channel',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 5 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private channelEntityService: ChannelEntityService,
		private queryService: QueryService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q = this.followingsRepository.createQueryBuilder('following').leftJoinAndSelect('following.followee', 'followee');
			const query = this.makePaginationQuery(
				q,
				ps.sinceId,
				ps.untilId,
				ps.sinceDate,
				ps.untilDate,
				'followee.channelId',
			)
				.andWhere({ followerId: me.id })
				.andWhere('followee.channelId IS NOT NULL');

			const followings = (await query
				.limit(ps.limit)
				.getMany()).map(x => x.followee?.channelId).filter(x => x != null);

			return await Promise.all(followings.map(x => this.channelEntityService.pack(x, me)));
		});
	}
	//queryServiceはjoinしたテーブルでソートができない
	private makePaginationQuery<T extends ObjectLiteral>(
		q: SelectQueryBuilder<T>,
		sinceId?: string | null,
		untilId?: string | null,
		sinceDate?: number | null,
		untilDate?: number | null,
		targetColumn = 'id',
	): SelectQueryBuilder<T> {
		if (sinceId && untilId) {
			q.andWhere(`${targetColumn} > :sinceId`, { sinceId: sinceId });
			q.andWhere(`${targetColumn} < :untilId`, { untilId: untilId });
			q.orderBy(`${targetColumn}`, 'DESC');
		} else if (sinceId) {
			q.andWhere(`${targetColumn} > :sinceId`, { sinceId: sinceId });
			q.orderBy(`${targetColumn}`, 'ASC');
		} else if (untilId) {
			q.andWhere(`${targetColumn} < :untilId`, { untilId: untilId });
			q.orderBy(`${targetColumn}`, 'DESC');
		} else if (sinceDate && untilDate) {
			q.andWhere(`${targetColumn} > :sinceId`, { sinceId: this.idService.gen(sinceDate) });
			q.andWhere(`${targetColumn} < :untilId`, { untilId: this.idService.gen(untilDate) });
			q.orderBy(`${targetColumn}`, 'DESC');
		} else if (sinceDate) {
			q.andWhere(`${targetColumn} > :sinceId`, { sinceId: this.idService.gen(sinceDate) });
			q.orderBy(`${targetColumn}`, 'ASC');
		} else if (untilDate) {
			q.andWhere(`${targetColumn} < :untilId`, { untilId: this.idService.gen(untilDate) });
			q.orderBy(`${targetColumn}`, 'DESC');
		} else {
			q.orderBy(`${targetColumn}`, 'DESC');
		}
		return q;
	}
}
