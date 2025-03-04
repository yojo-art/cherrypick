/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { MoreThan } from 'typeorm';
import type { InstancesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['federation'],

	requireCredential: false,

	allowGet: true,
	cacheSec: 60 * 60,

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			properties: {
				softwareName: {
					type: 'string',
					optional: false,
					nullable: false,
				},
				color: {
					type: 'string',
					optional: false,
					nullable: true,
				},
				count: {
					type: 'integer',
					optional: false,
					nullable: false,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		allInstance: {
			type: 'boolean',
			default: false,
			description: '`true`にすると連合していないインスタンスも含めます',
		},
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const queryResult = ps.allInstance ? await this.instancesRepository.find({
				select: ['softwareName'],
			},
			) : await this.instancesRepository.find({
				where: [
					{ followersCount: MoreThan(0) },
					{ followingCount: MoreThan(0) },
				],
				select: ['softwareName'],
			},
			);

			const softwareName = [...new Set(queryResult.map( x => x.softwareName))];
			return softwareName.map(s => ({
				softwareName: s ?? 'null',
				count: queryResult.filter(x => x.softwareName === s).length,
				color: getColor(s),
			}));
		});
	}
}

function getColor(name: string | null): string | null {
	switch (name) {
		case 'misskey':
			return '#86b300';
		case 'sharkey':
			return '#43BBE5';

		case 'cherrypick':
			return '#ffa9c3';
		case 'yojo-art':
			return '#ffbcdc';

		case 'mastodon':
			return '#6364FF';
		case 'kmyblue':
			return '#86AFE5';
		case 'fedibird':
			return '#282c37';

		case 'pleroma':
			return '#FAA459';
		case 'akkoma':
			return '#462E7A';

		//hollo,mitra,null
		default:
			return null;
	}
}
