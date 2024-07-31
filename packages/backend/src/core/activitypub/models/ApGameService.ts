/*
 * SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import type { MiRemoteUser, MiUser } from '@/models/User.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ReversiService } from '@/core/ReversiService.js';
import { isGame } from '../type.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApResolverService } from '../ApResolverService.js';
import { UserEntityService } from '../../entities/UserEntityService.js';
import type { Resolver } from '../ApResolverService.js';
import type { IApGame, ICreate, IInvite, IObject } from '../type.js';

@Injectable()
export class ApGameService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		private apResolverService: ApResolverService,
		private userEntityService: UserEntityService,
		private notificationService: NotificationService,
		private reversiService: ReversiService,
		private apLoggerService: ApLoggerService,
	) {
		this.logger = this.apLoggerService.logger;
	}
	reversiInboxInvite(local_user: MiUser, remote_user: MiRemoteUser, game_state: any) {
		this.reversiService.inviteFromRemoteUser(remote_user, local_user);
		//招待が飛んできたら通知を飛ばす
		this.notificationService.createNotification(local_user.id, 'app', {
			customBody: 'reversiInboxInvite',
			customHeader: null,
			customIcon: null,
			appAccessTokenId: null,
		});
	}
	@bindThis
	public async renderReversiInvite(game_session_id:string, invite_from:MiUser, invite_to:MiRemoteUser, invite_date:Date): Promise<IInvite> {
		const game:IApGame = {
			type: 'Game',
			game_type_uuid: '1c086295-25e3-4b82-b31e-3e3959906312',
			game_state: null,
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
}
