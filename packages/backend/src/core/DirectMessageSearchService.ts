/*
 * SPDX-FileCopyrightText: syuilo and noridev and other misskey, cherrypick contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { BlockingsRepository, MessagingMessagesRepository, MutingsRepository, UserGroupJoiningsRepository } from '@/models/_.js';
import type { MiMessagingMessage } from '@/models/MessagingMessage.js';
import type { MiUser } from '@/models/User.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { QueryService } from '@/core/QueryService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { CacheService } from '@/core/CacheService.js';

type K = string;
type V = string | number | boolean;
type Q =
	{ op: '=', k: K, v: V } |
	{ op: '!=', k: K, v: V } |
	{ op: '>', k: K, v: number } |
	{ op: '<', k: K, v: number } |
	{ op: '>=', k: K, v: number } |
	{ op: '<=', k: K, v: number } |
	{ op: 'is null', k: K } |
	{ op: 'is not null', k: K } |
	{ op: 'and', qs: Q[] } |
	{ op: 'or', qs: Q[] } |
	{ op: 'not', q: Q };

@Injectable()
export class DirectMessageSearchService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.messagingMessagesRepository)
		private messagingMessagesRepository: MessagingMessagesRepository,

		@Inject(DI.userGroupJoiningsRepository)
		private userGroupJoiningsRepository: UserGroupJoiningsRepository,

		@Inject(DI.mutingsRepository)
		private mutingsRepository: MutingsRepository,

		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		private cacheService: CacheService,
		private queryService: QueryService,
		private userEntityService: UserEntityService,
	) {

	}

	@bindThis
	public async searchMessages(q: string, me: MiUser | null, opts: {
		recipient?: MiMessagingMessage['recipientId'] | null;
		groupId?: MiMessagingMessage['groupId'] | null;
	}, pagination: {
		untilId?: MiMessagingMessage['id'];
		sinceId?: MiMessagingMessage['id'];
		limit?: number;
	}): Promise<MiMessagingMessage[]> {
		if (me === null) return [];
		const query = this.queryService.makePaginationQuery(this.messagingMessagesRepository.createQueryBuilder('message'), pagination.sinceId, pagination.untilId);
		query
			.andWhere('message.text ILIKE :q', { q: `%${ sqlLikeEscape(q)}%` })
			.innerJoinAndSelect('message.user', 'user')
			.leftJoinAndSelect('message.group', 'group');

		if (opts.groupId) {
			query.andWhere(new Brackets(qb => {
				qb
					.where('message.groupId IN (:...groups)', { groups: [opts.groupId] })
					.orWhere(':userId = ANY(message.reads)', { userId: me.id });
			}));
		} else {
			query.andWhere(new Brackets(qb => {
				qb
					.where('message.userId = :userId', { userId: me.id })
					.orWhere('message.recipientId = :userId', { userId: me.id });
			}));
			query.andWhere('message.groupId IS NULL');
		}

		return await query.limit(pagination.limit).getMany();
	}
}
