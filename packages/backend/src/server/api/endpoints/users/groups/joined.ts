/*
 * SPDX-FileCopyrightText: syuilo and misskey-project & noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Not, In } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { UserGroupsRepository, UserGroupJoiningsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { UserGroupEntityService } from '@/core/entities/UserGroupEntityService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['groups', 'account'],

	requireCredential: true,

	kind: 'read:user-groups',

	description: 'List the groups that the authenticated user is a member of.',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'UserGroup',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userGroupJoiningsRepository)
		private userGroupJoiningsRepository: UserGroupJoiningsRepository,

		private userGroupEntityService: UserGroupEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(
				this.userGroupJoiningsRepository.createQueryBuilder('joining'),
				ps.sinceId,
				ps.untilId,
				null,
				null,
				'userGroupId',
			)
				.andWhere('joining.userId = :userId', { userId: me.id })
				.innerJoinAndSelect('joining.userGroup', 'user_group')
				.andWhere('user_group.userId != :userId', { userId: me.id }); // 自分が作ったグループを除外

			const joinings = await query
				.take(ps.limit)
				.getMany();

			return await this.userGroupEntityService.packMany(
				joinings.map(x => x.userGroup!),
			);
		});
	}
}
