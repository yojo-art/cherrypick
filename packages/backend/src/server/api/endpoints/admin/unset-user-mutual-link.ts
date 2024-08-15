/*
 * SPDX-FileCopyrightText: syuilo and misskey-project MisskeyIO
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type {
	UsersRepository,
	UserProfilesRepository,
} from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:unset-user-mutual-link',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['userId'],
} as const;
 
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const user = await this.usersRepository.findOneBy({ id: ps.userId });
			const userProfile = await this.userProfilesRepository.findOneBy({ userId: ps.userId });

			if (user == null || userProfile == null) {
				throw new Error('user not found');
			}

			await this.userProfilesRepository.update(user.id, {
				mutualLinkSections: [],
			});

			this.moderationLogService.log(me, 'unsetUserMutualLink', {
				userId: user.id,
				userUsername: user.username,
				userMutualLinkSections: userProfile.mutualLinkSections,
			});
		});
	}
}
