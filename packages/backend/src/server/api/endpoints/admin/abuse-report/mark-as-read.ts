/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	// 状態を書き換えるため write scope とし、通報の対応 (解決) と同じ権限にする
	kind: 'write:admin:resolve-abuse-user-report',
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private userEntityService: UserEntityService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const redisPipeline = this.redisClient.pipeline();
			redisPipeline.del(`unreadAbuseReport:${me.id}`);
			redisPipeline.set(`readAbuseReport:${me.id}`, '1');
			await redisPipeline.exec();

			this.userEntityService.pack(me.id, me, {
				schema: 'MeDetailed',
			}).then(packed => this.globalEventService.publishMainStream(me.id, 'meUpdated', packed))
				// best-effort: 配信できなくても次回の /i 取得で反映されるため握りつぶす
				.catch(() => {});
		});
	}
}
