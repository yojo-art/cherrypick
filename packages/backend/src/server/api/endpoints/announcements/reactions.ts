/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AnnouncementReactionsRepository, AnnouncementsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { AnnouncementReactionEntityService } from '@/core/entities/AnnouncementReactionEntityService.js';
import { DI } from '@/di-symbols.js';
import { QueryService } from '@/core/QueryService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['announcements', 'reactions'],

	requireCredential: false,

	allowGet: true,
	cacheSec: 60,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'AnnouncementReaction',
		},
	},

	errors: {
		noSuchAnnouncement: {
			message: 'No such announcement.',
			code: 'NO_SUCH_ANNOUNCEMENT',
			id: '28b39ced-db83-40f5-abba-af9111ee8f06',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		announcementId: { type: 'string', format: 'misskey:id' },
		type: { type: 'string', nullable: true },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: ['announcementId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,

		@Inject(DI.announcementReactionsRepository)
		private announcementReactionsRepository: AnnouncementReactionsRepository,

		private announcementReactionEntityService: AnnouncementReactionEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const exist = await this.announcementsRepository.exists({
				where: { id: ps.announcementId },
			});

			if (!exist) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			const query = this.queryService.makePaginationQuery(this.announcementReactionsRepository.createQueryBuilder('reaction'), ps.sinceId, ps.untilId)
				.andWhere('reaction.announcementId = :announcementId', { announcementId: ps.announcementId })
				.leftJoinAndSelect('reaction.user', 'user');

			if (ps.type) {
				// ローカルリアクションはホスト名が . とされているが
				// DB 上ではそうではないので、必要に応じて変換
				const suffix = '@.:';
				const type = ps.type.endsWith(suffix) ? ps.type.slice(0, ps.type.length - suffix.length) + ':' : ps.type;
				query.andWhere('reaction.reaction = :type', { type });
			}

			const reactions = await query.limit(ps.limit).getMany();

			return await this.announcementReactionEntityService.packMany(reactions, me);
		});
	}
}
