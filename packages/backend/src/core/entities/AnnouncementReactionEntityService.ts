/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DI } from '@/di-symbols.js';
import type { AnnouncementReactionsRepository } from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { MiUser } from '@/models/User.js';
import type { MiAnnouncementReaction } from '@/models/AnnouncementReaction.js';
import type { ReactionService } from '../ReactionService.js';
import type { UserEntityService } from './UserEntityService.js';

@Injectable()
export class AnnouncementReactionEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private reactionService: ReactionService;
	private idService: IdService;

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.announcementReactionsRepository)
		private announcementReactionsRepository: AnnouncementReactionsRepository,
	) {
	}

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.reactionService = this.moduleRef.get('ReactionService');
		this.idService = this.moduleRef.get('IdService');
	}

	@bindThis
	public async pack(
		src: MiAnnouncementReaction['id'] | MiAnnouncementReaction,
		me?: { id: MiUser['id'] } | null | undefined,
	): Promise<Packed<'AnnouncementReaction'>> {
		const reaction = typeof src === 'object' ? src : await this.announcementReactionsRepository.findOneByOrFail({ id: src });

		return {
			id: reaction.id,
			createdAt: this.idService.parse(reaction.id).date.toISOString(),
			user: await this.userEntityService.pack(reaction.user ?? reaction.userId, me),
			type: this.reactionService.convertLegacyReaction(reaction.reaction),
		};
	}

	@bindThis
	public async packMany(
		reactions: MiAnnouncementReaction[],
		me?: { id: MiUser['id'] } | null | undefined,
	): Promise<Packed<'AnnouncementReaction'>[]> {
		return Promise.all(reactions.map(reaction => this.pack(reaction, me)));
	}
}
