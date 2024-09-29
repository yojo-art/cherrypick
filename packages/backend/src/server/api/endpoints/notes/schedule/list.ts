/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { MiNoteSchedule, NoteScheduleRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { QueryService } from '@/core/QueryService.js';
import { Packed } from '@/misc/json-schema.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
				note: {
					type: 'object',
					optional: false, nullable: false,
					properties: {
						id: { type: 'string', optional: false, nullable: false },
						text: { type: 'string', optional: false, nullable: false },
						cw: { type: 'string', optional: true, nullable: true },
						fileIds: { type: 'array', optional: false, nullable: false, items: { type: 'string', format: 'misskey:id', optional: false, nullable: false } },
						visibility: { type: 'string', enum: ['public', 'home', 'followers', 'specified'], optional: false, nullable: false },
						visibleUsers: {
							type: 'array', optional: false, nullable: false, items: {
								type: 'object',
								optional: false, nullable: false,
								ref: 'UserLite',
							},
						},
						user: {
							type: 'object',
							optional: false, nullable: false,
							ref: 'User',
						},
						reactionAcceptance: { type: 'string', nullable: true, enum: [null, 'likeOnly', 'likeOnlyForRemote', 'nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote'], default: null },
						createdAt: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
						isSchedule: { type: 'boolean', optional: false, nullable: false },
					},
				},
				userId: { type: 'string', optional: false, nullable: false },
				expiresAt: { type: 'string', optional: false, nullable: false },
			},
		},
	},
	limit: {
		duration: ms('1hour'),
		max: 300,
	},

	errors: {
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
	},
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.noteScheduleRepository)
		private noteScheduleRepository: NoteScheduleRepository,

		private userEntityService: UserEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.noteScheduleRepository.createQueryBuilder('note'), ps.sinceId, ps.untilId)
				.andWhere('note.userId = :userId', { userId: me.id });
			const scheduleNotes = await query.limit(ps.limit).getMany();
			const user = await this.userEntityService.pack(me, me);
			const scheduleNotesPack: {
				id: string;
				note: {
					id: string;
					text: string;
					cw?: string|null;
					fileIds: string[];
					visibility: 'public' | 'home' | 'followers' | 'specified';
					visibleUsers: Packed<'UserLite'>[];
					reactionAcceptance: 'likeOnly'|'likeOnlyForRemote'| 'nonSensitiveOnly'| 'nonSensitiveOnlyForLocalLikeOnlyForRemote'| null;
					user: Packed<'User'>;
					createdAt: string;
					isSchedule: boolean;
				};
				userId: string;
				expiresAt: string;
			}[] = await Promise.all(scheduleNotes.map(async (item: MiNoteSchedule) => {
				return {
					...item,
					expiresAt: item.expiresAt.toISOString(),
					note: {
						...item.note,
						user: user,
						visibleUsers: await userEntityService.packMany(item.note.visibleUsers, me),
						fileIds: item.note.files.map(f => f.id),
						createdAt: item.expiresAt.toISOString(),
						isSchedule: true,
						id: item.id,
					},
				};
			}));

			return scheduleNotesPack;
		});
	}
}
