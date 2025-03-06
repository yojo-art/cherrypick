/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere, MoreThan, In, Not } from 'typeorm';
import type { InstancesRepository, MiInstance } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { MetaService } from '@/core/MetaService.js';

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
		blocked: { type: 'boolean', nullable: true },
		notResponding: { type: 'boolean', nullable: true },
		suspended: { type: 'boolean', nullable: true },
		silenced: { type: 'boolean', nullable: true },
		federating: { type: 'boolean', nullable: true },
		subscribing: { type: 'boolean', nullable: true },
		publishing: { type: 'boolean', nullable: true },
		quarantined: { type: 'boolean', nullable: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		private metaService: MetaService,
	) {
		super(meta, paramDef, async (ps) => {
			let options: FindOptionsWhere<MiInstance>[] | undefined = undefined;

			if (ps.blocked || ps.silenced || ps.federating || ps.subscribing || ps.publishing || ps.suspended || ps.quarantined || ps.notResponding ) {
				options = [];
				if (typeof ps.blocked === 'boolean' || typeof ps.silenced === 'boolean') {
					const meta = await this.metaService.fetch(true);

					if (typeof ps.blocked === 'boolean') {
						if (ps.blocked) {
							options.push({ host: In(meta.blockedHosts) });
						} else {
							options.push({ host: Not(In(meta.blockedHosts)) });
						}
					}

					if (typeof ps.silenced === 'boolean') {
						if (ps.silenced) {
							options.push({ host: In(meta.silencedHosts) });
						} else {
							options.push({ host: Not(In(meta.silencedHosts)) });
						}
					}
				}
				if (typeof ps.federating === 'boolean') {
					if (ps.federating) {
						options.push({
							followersCount: MoreThan(0),
							followingCount: MoreThan(0),
						});
					} else {
						options.push({
							followersCount: 0,
							followingCount: 0,
						});
					}
				} else {
					if (typeof ps.subscribing === 'boolean') {
						if (ps.subscribing) {
							options.push({ followersCount: MoreThan(0) });
						} else {
							options.push({ followersCount: 0 });
						}
					}
					if (typeof ps.publishing === 'boolean') {
						if (ps.publishing) {
							options.push({ followingCount: MoreThan(0) });
						} else {
							options.push({ followingCount: 0 });
						}
					}
				}
				if (typeof ps.suspended === 'boolean') {
					if (ps.suspended) {
						options.push({ suspensionState: 'none' });
					} else {
						options.push({ suspensionState: Not('none') });
					}
				}

				if (typeof ps.quarantined === 'boolean') {
					if (ps.quarantined) {
						options.push({ quarantineLimited: true });
					} else {
						options.push({ quarantineLimited: false });
					}
				}

				if (typeof ps.notResponding === 'boolean') {
					if (ps.notResponding) {
						options.push({ isNotResponding: true });
					} else {
						options.push({ isNotResponding: false });
					}
				}
			}

			const queryResult = await this.instancesRepository.find({
				where: options,
				select: ['softwareName'],
			});

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
