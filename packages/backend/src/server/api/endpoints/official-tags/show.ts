/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { OfficialTagRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['official-Tags'],
	limit: {
		duration: 1000 * 60,
		max: 30,
	},
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			properties: {
				tag: {
					type: 'string',
					optional: false, nullable: false,
				},
				description: {
					type: 'string',
					optional: false, nullable: true,
				},
				bannerUrl: {
					type: 'string',
					optional: false, nullable: true,
				},
				priority: {
					type: 'number',
					optional: false, nullable: false,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.officialTagRepository)
		private officialTagRepository: OfficialTagRepository,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.officialTagRepository.createQueryBuilder('official_tag'));
			const values = await query.orderBy('priority').getMany();
			return values.map(data => {
				//DB上の構造からAPI用の構造に変換
				return {
					tag: data.name,
					description: data.description,
					bannerUrl: data.bannerUrl,
					priority: data.priority,
				};
			});
		});
	}
}
