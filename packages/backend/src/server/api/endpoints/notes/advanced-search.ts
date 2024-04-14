/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { AdvancedSearchService } from '@/core/AdvancedSearchService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},

	errors: {
		unavailable: {
			message: 'Advanced Search is unavailable.',
			code: 'UNAVAILABLE',
			id: '2f621660-e9b4-11ee-b87d-00155d0c9b27',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		query: { type: 'string' },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		origin: { type: 'string', enum: ['local', 'remote', 'combined'], default: 'combined' },
		fileOption: { type: 'string', enum: ['file-only', 'no-file', 'combined'], default: 'combined' },
		offset: { type: 'integer', default: 0 },
		host: {
			type: 'string',
			description: 'The local host is represented with `.`.',
		},
		excludeNsfw: { type: 'boolean', default: false },
		excludeReply: { type: 'boolean', default: false },
		startDate: { type: 'integer', nullable: true },
		endDate: { type: 'integer', nullable: true },
		userId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
		channelId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
	},
	required: ['query'],
} as const;

// Todo: スリムにする

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		private noteEntityService: NoteEntityService,
		private roleService: RoleService,
		private advancedSearchService: AdvancedSearchService,
	) {
		super(meta, paramDef, async(ps, me) => {
			const policies = await this.roleService.getUserPolicies(me ? me.id : null);
			if (!policies.canAdvancedSearchNotes) {
				throw new ApiError(meta.errors.unavailable);
			}

			const startDate = ps.startDate ? new Date(ps.startDate) : null;
			const endDate = ps.endDate ? new Date(ps.endDate) : null;

			const notes = await this.advancedSearchService.searchNote(ps.query, me, {
				userId: ps.userId,
				channelId: ps.channelId,
				host: ps.host,
				origin: ps.origin,
				fileOption: ps.fileOption,
				excludeNsfw: ps.excludeNsfw,
				excludeReply: ps.excludeReply,
				startDate: startDate,
				endDate: endDate,
			}, {
				untilId: ps.untilId,
				sinceId: ps.sinceId,
				limit: ps.limit,
			});

			return await this.noteEntityService.packMany(notes, me);
		});
	}
}
