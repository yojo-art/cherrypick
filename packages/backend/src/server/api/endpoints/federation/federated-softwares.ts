/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { InstancesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['federation'],

	requireCredential: false,

	allowGet: true,
	cacheSec: 60 * 60,

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			softwareAndCounts: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'object',
					optional: false,
					nullable: false,
				},
			},
			knownSoftwares: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'string',
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
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
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
			const queryResult = await this.instancesRepository.find({
					select: ['softwareName'],
				}
			);

			const knownSoftware = [...new Set (queryResult.map( x=> x.softwareName))];
			const softwareAndCounts = knownSoftware.map(s => {
				return {
					softwareName: s ?? 'null',
					count: queryResult.filter(x => x.softwareName === s).length,
					color: getColor(s)
				};
			});
			return {
				softwareAndCounts,
				knownSoftwares: knownSoftware
			};
		});
	}
}
function getColor(name: string | null): string | null
{
	switch (name)
	{
		case 'misskey':
			return '#86b300';
		case 'yojo-art':
			return '#ffbcdc';
		case 'cherrypick':
			return '#ffa9c3';
		case 'fedibird':
			return '#282c37';
		/*
	case 'mastodon':
		return '#593196';
	case 'akkoma':
		return '#593196';
	case 'sharkey':
		return '#ffbcdc';
	*/
			//hollo,mitra,null
			default:
				return null;
	}
}
