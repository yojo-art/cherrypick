/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ChannelFollowingService } from '@/core/ChannelFollowingService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:channels',

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'c0031718-d573-4e85-928e-10039f1fbb68',
		},
		alreadyFollowing: {
			message: 'You are already following that channel.',
			code: 'ALREADY_FOLLOWING',
			id: '7db31665-651e-40c1-8e6e-28e9ad829a2d',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
		private channelFollowingService: ChannelFollowingService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({
				id: ps.channelId,
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			try {
				await this.channelFollowingService.follow(me, channel);
			} catch (e) {
				if (e instanceof IdentifiableError) {
					// yojo-art: ChannelFollowingsRepositoryが削除されているため、uuidがmisskeyのものと異なる
					if (e.id === 'ec3f65c0-a9d1-47d9-8791-b2e7b9dcdced') throw new ApiError(meta.errors.alreadyFollowing);
				}
				throw e;
			}
		});
	}
}
