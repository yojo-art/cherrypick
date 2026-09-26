/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { QueryService } from '@/core/QueryService.js';
import type { AvatarDecorationsRepository } from '@/models/_.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requiredRolePolicy: 'canManageAvatarDecorations',
	kind: 'read:admin:avatar-decorations',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
					example: 'xxxxxxxxxx',
				},
				createdAt: {
					type: 'string',
					optional: false, nullable: false,
					format: 'date-time',
				},
				updatedAt: {
					type: 'string',
					optional: false, nullable: true,
					format: 'date-time',
				},
				name: {
					type: 'string',
					optional: false, nullable: false,
				},
				description: {
					type: 'string',
					optional: false, nullable: false,
				},
				url: {
					type: 'string',
					optional: false, nullable: false,
				},
				host: {
					type: 'string',
					optional: false, nullable: false,
				},
				roleIdsThatCanBeUsedThisDecoration: {
					type: 'array',
					optional: false, nullable: false,
					items: {
						type: 'string',
						optional: false, nullable: false,
						format: 'id',
					},
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
		userId: { type: 'string', format: 'misskey:id', nullable: true },
		host: { type: 'string' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.avatarDecorationsRepository)
		private avatarDecorationsRepository: AvatarDecorationsRepository,

		private idService: IdService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(
				this.avatarDecorationsRepository.createQueryBuilder('avatar_decoration'), ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate);

			if (ps.host) {
				query.andWhere('avatar_decoration.host = :host', { host: ps.host });
			} else {
				query.andWhere('avatar_decoration.host IS NOT NULL');
			}

			const avatarDecorations = await query.limit(ps.limit).getMany();

			return avatarDecorations.map(avatarDecorations => ({
				id: avatarDecorations.id,
				createdAt: this.idService.parse(avatarDecorations.id).date.toISOString(),
				updatedAt: avatarDecorations.updatedAt?.toISOString() ?? null,
				name: avatarDecorations.name,
				description: avatarDecorations.description,
				url: avatarDecorations.url,
				roleIdsThatCanBeUsedThisDecoration: avatarDecorations.roleIdsThatCanBeUsedThisDecoration,
				host: avatarDecorations.host!,
			}));
		});
	}
}
