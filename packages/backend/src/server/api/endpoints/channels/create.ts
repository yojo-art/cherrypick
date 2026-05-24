/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import * as argon2 from 'argon2';
import { Not, IsNull } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository, DriveFilesRepository, MiUser, UsersRepository } from '@/models/_.js';
import type { MiChannel } from '@/models/Channel.js';
import { IdService } from '@/core/IdService.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { SignupService } from '@/core/SignupService.js';
import { RoleService } from '@/core/RoleService.js';
import { FastifyReplyError } from '@/misc/fastify-reply-error.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:channels',

	limit: {
		duration: ms('1hour'),
		max: 10,
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Channel',
	},

	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'cd1e9f3e-5a12-4ab4-96f6-5d0a2cc32050',
		},

		invalidUsername: {
			message: 'Invalid Username',
			code: 'INVALID_USERNAME',
			id: '3f7d8c21-1c57-4854-9f02-0a2b4fc229df',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 128 },
		description: { type: 'string', nullable: true, minLength: 1, maxLength: 2048 },
		bannerId: { type: 'string', format: 'misskey:id', nullable: true },
		color: { type: 'string', minLength: 1, maxLength: 16 },
		isSensitive: { type: 'boolean', nullable: true },
		allowRenoteToExternal: { type: 'boolean', nullable: true },
		username: { type: 'string' },
	},
	required: ['username'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private idService: IdService,
		private channelEntityService: ChannelEntityService,
		private userEntityService: UserEntityService,
		private signupService: SignupService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let banner = null;
			if (ps.bannerId != null) {
				banner = await this.driveFilesRepository.findOneBy({
					id: ps.bannerId,
					userId: me.id,
				});

				if (banner == null) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			}
			// Validate username
			if (ps.username && !this.userEntityService.validateLocalUsername(ps.username)) {
				throw new ApiError(meta.errors.invalidUsername);
			}
			const user = await this.usersRepository.findOneBy({
				usernameLower: ps.username.toLocaleLowerCase(),
				channelId: Not(IsNull()),
			});
			if (user && user.channelId) {
				//すでにチャンネルアカウントがある
				const channel = await this.channelsRepository.findOneBy({
					id: user.channelId,
				});
				if (channel) {
					//チャンネルもあるなら関連付けして終了
					await this.channelsRepository.update(channel.id, {
						...(ps.name !== undefined ? { name: ps.name } : {}),
						...(ps.description !== undefined ? { description: ps.description } : {}),
						...(ps.color !== undefined ? { color: ps.color } : {}),
						...(banner ? { bannerId: banner.id } : {}),
						...(typeof ps.isSensitive === 'boolean' ? { isSensitive: ps.isSensitive } : {}),
						...(typeof ps.allowRenoteToExternal === 'boolean' ? { allowRenoteToExternal: ps.allowRenoteToExternal } : {}),
						actor: user,
						actorId: user.id,
					});
					return await this.channelEntityService.pack({
						...channel,
						...(ps.name !== undefined ? { name: ps.name } : {}),
						...(ps.description !== undefined ? { description: ps.description } : {}),
						...(ps.color !== undefined ? { color: ps.color } : {}),
						...(banner ? { bannerId: banner.id } : {}),
						...(typeof ps.isSensitive === 'boolean' ? { isSensitive: ps.isSensitive } : {}),
						...(typeof ps.allowRenoteToExternal === 'boolean' ? { allowRenoteToExternal: ps.allowRenoteToExternal } : {}),
						actor: user,
						actorId: user.id,
					}, me);
				}
			}
			const channel = await this.channelsRepository.insertOne({
				id: this.idService.gen(),
				name: ps.name ?? ps.username,
				description: ps.description ?? null,
				bannerId: banner ? banner.id : null,
				isSensitive: ps.isSensitive ?? false,
				...(ps.color !== undefined ? { color: ps.color } : {}),
				allowRenoteToExternal: ps.allowRenoteToExternal ?? true,
			});
			let actor:MiUser;
			if (user == null) {
				//チャンネルアカウントを作成
				try {
					const password = randomUUID() + randomUUID();

					// Generate hash of password
					//const salt = await bcrypt.genSalt(8);
					//どうせログインしないのでパスワードは適当
					const hash = await argon2.hash(password);

					const { account, secret } = await signupService.signup({
						username: ps.username,
						ignorePreservedUsernames: await this.roleService.isModerator(me),
						password: hash,
					});
					actor = account;
				} catch (err) {
					throw new FastifyReplyError(400, typeof err === 'string' ? err : (err as Error).toString());
				}
			} else {
				actor = user;
			}

			await this.channelsRepository.update(channel.id, {
				actor,
				actorId: actor.id,
			});

			return await this.channelEntityService.pack({
				...channel,
				actor,
				actorId: actor.id,
			}, me);
		});
	}
}
