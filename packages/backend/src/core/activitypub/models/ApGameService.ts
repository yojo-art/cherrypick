/*
 * SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import type { MiLocalUser, MiRemoteUser, MiUser } from '@/models/User.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ReversiService } from '@/core/ReversiService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { isGame } from '../type.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApResolverService } from '../ApResolverService.js';
import { UserEntityService } from '../../entities/UserEntityService.js';
import type { Resolver } from '../ApResolverService.js';
import type { IApGame, ICreate, IInvite, IJoin, IObject, IUndo } from '../type.js';

@Injectable()
export class ApGameService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private apResolverService: ApResolverService,
		private userEntityService: UserEntityService,
		private notificationService: NotificationService,
		private globalEventService: GlobalEventService,
		private apLoggerService: ApLoggerService,
	) {
		this.logger = this.apLoggerService.logger;
	}
	async reversiInboxJoin(local_user: MiUser, arg1: MiRemoteUser, game: IApGame) {
		console.log('リバーシのJoinが飛んできた' + JSON.stringify(game.game_state));
	}
	async reversiInboxUndoInvite(actor: MiRemoteUser, target_user:MiLocalUser, game: IApGame) {
		await this.redisClient.zrem(`reversi:matchSpecific:${target_user.id}`, JSON.stringify({
			from_user_id: actor.id,
			game_session_id: game.game_state.game_session_id,
		}));
	}
	async reversiInboxInvite(local_user: MiUser, remote_user: MiRemoteUser, game_state: any) {
		const targetUser = local_user;
		const fromUser = remote_user;
		const redisPipeline = this.redisClient.pipeline();
		if (!game_state.game_session_id) throw Error('bad session');
		redisPipeline.zadd(`reversi:matchSpecific:${targetUser.id}`, Date.now(), JSON.stringify( {
			from_user_id: fromUser.id,
			game_session_id: game_state.game_session_id,
		}));
		redisPipeline.expire(`reversi:matchSpecific:${targetUser.id}`, 120, 'NX');
		await redisPipeline.exec();

		this.globalEventService.publishReversiStream(targetUser.id, 'invited', {
			user: await this.userEntityService.pack(fromUser, targetUser),
		});
	}
	@bindThis
	public async renderReversiInvite(game_session_id:string, invite_from:MiUser, invite_to:MiRemoteUser, invite_date:Date): Promise<IInvite> {
		const game:IApGame = {
			type: 'Game',
			game_type_uuid: '1c086295-25e3-4b82-b31e-3e3959906312',
			game_state: {
				game_session_id,
			},
		};
		const activity: IInvite = {
			id: `${this.config.url}/games/${game.game_type_uuid}/${game_session_id}/activity`,
			actor: this.userEntityService.genLocalUserUri(invite_from.id),
			type: 'Invite',
			published: invite_date.toISOString(),
			object: game,
		};
		activity.to = invite_to.uri;//フォロワー限定に招待する場合は`${actor.uri}/followers`
		activity.cc = [];//誰でも観戦が許可される場合はCCに"https://www.w3.org/ns/activitystreams#Public"を指定

		return activity;
	}
	@bindThis
	public async renderReversiJoin(game_session_id:string, join_user:MiUser, invite_from:MiRemoteUser, join_date:Date): Promise<IJoin> {
		const game:IApGame = {
			type: 'Game',
			game_type_uuid: '1c086295-25e3-4b82-b31e-3e3959906312',
			game_state: {
				game_session_id,
			},
		};
		const activity: IJoin = {
			id: `${this.config.url}/games/${game.game_type_uuid}/${game_session_id}/activity`,
			actor: this.userEntityService.genLocalUserUri(join_user.id),
			type: 'Join',
			published: join_date.toISOString(),
			object: game,
		};
		activity.to = invite_from.uri;//フォロワー限定に招待する場合は`${actor.uri}/followers`
		activity.cc = [];//誰でも観戦が許可される場合はCCに"https://www.w3.org/ns/activitystreams#Public"を指定

		return activity;
	}
}
