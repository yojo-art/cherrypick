/*
 * SPDX-FileCopyrightText: syuilo and noridev and other misskey, cherrypick contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from "@nestjs/common";
import { Endpoint } from "@/server/api/endpoint-base.js";
import { Brackets } from "typeorm";
import { DI } from "@/di-symbols.js";
import { GetterService } from '@/server/api/GetterService.js'
import { ApiError } from "../../error.js";
import type { UserGroupsRepository, MessagingMessagesRepository, UserGroupJoiningsRepository } from "@/models/_.js";
import { QueryService } from "@/core/QueryService.js";
import { UserEntityService } from "@/core/entities/UserEntityService.js";
import { MessagingMessageEntityService } from "@/core/entities/MessagingMessageEntityService.js";
import { MessagingService } from "@/core/MessagingService.js";
import { NoteEntityService } from "@/core/entities/NoteEntityService.js";

export const meta = {
	tags: ['notes', 'messaging'],

	requireCredential: true,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: ['Note', 'MessagingMessage'],
		},
	},

	errors: {
		noSuchMessage: {
			message: 'No such message or Direct Message.',
			code: 'NO_SUCH_MESSAGE',
			id: '5e086500-f40e-11ee-90b4-00155d403610',
		},
	},
} as const;

export const paramDef = { 
	type: 'object',
	properties: {
		query: { type: 'string' },
		
	},
	required: ['query'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.messagingMessagesRepository)
		private messagingMessagesRepository: MessagingMessagesRepository,

		@Inject(DI.userGroupsRepository)
		private userGroupsRepository: UserGroupsRepository,

		@Inject(DI.userGroupJoiningsRepository)
		private userGroupJoiningsRepository: UserGroupJoiningsRepository,

		
	)
}