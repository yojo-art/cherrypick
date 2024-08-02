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
import type { ReversiGamesRepository } from '@/models/_.js';
import { isGame } from '../type.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApResolverService } from '../ApResolverService.js';
import { UserEntityService } from '../../entities/UserEntityService.js';
import type { Resolver } from '../ApResolverService.js';
import type { IApGame, ICreate, IInvite, IJoin, IObject, IUndo, IUpdate } from '../type.js';

@Injectable()
export class ApGameService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.reversiGamesRepository)
		private reversiGamesRepository: ReversiGamesRepository,

		private apResolverService: ApResolverService,
		private userEntityService: UserEntityService,
		private notificationService: NotificationService,
		private globalEventService: GlobalEventService,
		private apLoggerService: ApLoggerService,
		private reversiService: ReversiService,
	) {
		this.logger = this.apLoggerService.logger;
	}
	async reversiInboxUpdate(local_user: MiUser, remote_user: MiRemoteUser, apgame: IApGame) {
		console.log('リバーシのUpdateが飛んできた' + JSON.stringify(apgame.game_state));
		const key = apgame.game_state.key;
		const value = apgame.game_state.value;
		const id = await this.gameIdFromUUID(apgame.game_state.game_session_id);
		if (id === null) {
			console.error('Update reversi Id Solve error');
			return;
		}
		const game = await this.reversiService.updateSettings(id, remote_user, key, value, false);
		this.globalEventService.publishReversiGameStream(id, 'updateSettings', {
			userId: remote_user.id,
			key: key,
			value: value,
		});
	}
	async reversiInboxJoin(local_user: MiUser, remote_user: MiRemoteUser, game: IApGame) {
		const targetUser = local_user;
		const fromUser = remote_user;
		if (!game.game_state.game_session_id) throw Error('bad session' + JSON.stringify(game));
		const redisPipeline = this.redisClient.pipeline();
		redisPipeline.zadd(`reversi:matchSpecific:${targetUser.id}`, Date.now(), JSON.stringify( {
			from_user_id: fromUser.id,
			game_session_id: game.game_state.game_session_id,
		}));
		redisPipeline.expire(`reversi:matchSpecific:${targetUser.id}`, 120, 'NX');
		await redisPipeline.exec();
	}
	async reversiInboxUndoInvite(actor: MiRemoteUser, target_user:MiLocalUser, game: IApGame) {
		await this.redisClient.zrem(`reversi:matchSpecific:${target_user.id}`, JSON.stringify({
			from_user_id: actor.id,
			game_session_id: game.game_state.game_session_id,
		}));
	}
	async reversiInboxInvite(local_user: MiUser, remote_user: MiRemoteUser, game: IApGame) {
		const targetUser = local_user;
		const fromUser = remote_user;
		if (!game.game_state.game_session_id) throw Error('bad session' + JSON.stringify(game));
		const redisPipeline = this.redisClient.pipeline();
		redisPipeline.zadd(`reversi:matchSpecific:${targetUser.id}`, Date.now(), JSON.stringify( {
			from_user_id: fromUser.id,
			game_session_id: game.game_state.game_session_id,
		}));
		redisPipeline.expire(`reversi:matchSpecific:${targetUser.id}`, 120, 'NX');
		await redisPipeline.exec();

		this.globalEventService.publishReversiStream(targetUser.id, 'invited', {
			user: await this.userEntityService.pack(fromUser, targetUser),
		});
	}
	public async gameIdFromUUID(game_session_id:string) :Promise<string|null> {
		//キャッシュにあればそれ
		const cache = await this.redisClient.get(`reversi:federationId:${game_session_id}`);
		if (cache) {
			return cache;
		}
		//無かったらDBから探す
		const game = await this.reversiGamesRepository.findOneBy({ federationId: game_session_id });
		if (game !== null) {
			const redisPipeline = this.redisClient.pipeline();
			redisPipeline.set(`reversi:federationId:${game_session_id}`, game.id);
			redisPipeline.expire(`reversi:federationId:${game_session_id}`, 300);//適当、いい感じにしたい
			await redisPipeline.exec();
			if (cache) {
				return cache;
			}
			return game.id;
		}
		//DBにも無いなら知らん
		return null;
	}
}
