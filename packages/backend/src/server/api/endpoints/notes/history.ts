/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteUpdateService } from '@/core/NoteUpdateService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import type { DriveFilesRepository, MiDriveFile } from '@/models/_.js';
import { NoteHistoryEntityService } from '@/core/entities/NoteHistoryEntityService.js';
import { NoteHistorySerivce } from '@/core/NoteHistoryService.js';
import { MiMeta } from '@/models/Meta.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],

	requireCredential: false,

	limit: {
		duration: ms('1min'),
		max: 60,
		minInterval: ms('1sec'),
	},

	stability: 'experimental',

	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '596e916b-c4d7-45f2-9d49-ecbbb99ac1c0',
		},

		contentRestrictedByUser: {
			message: 'Content restricted by user. Please sign in to view.',
			code: 'CONTENT_RESTRICTED_BY_USER',
			id: 'd2b6478e-5706-4722-b662-79c17a405c2d',
		},

		contentRestrictedByServer: {
			message: 'Content restricted by server settings. Please sign in to view.',
			code: 'CONTENT_RESTRICTED_BY_SERVER',
			id: 'e87ce5df-15f0-4582-b7e5-dee7a978b0a0',
		},
	},
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'NoteHistory',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: ['noteId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.meta)
		private serverSettings: MiMeta,

		private noteHistoryEntityService: NoteHistoryEntityService,
		private noteHistoryService: NoteHistorySerivce,
		private getterService: GetterService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNoteWithRelations(ps.noteId).catch(err => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') throw new ApiError(meta.errors.noSuchNote);
				throw err;
			});

			if (note.user!.requireSigninToViewContents && me == null) {
				throw new ApiError(meta.errors.contentRestrictedByUser);
			}

			if (this.serverSettings.ugcVisibilityForVisitor === 'none' && me == null) {
				throw new ApiError(meta.errors.contentRestrictedByServer);
			}

			if (this.serverSettings.ugcVisibilityForVisitor === 'local' && note.userHost != null && me == null) {
				throw new ApiError(meta.errors.contentRestrictedByServer);
			}

			const note_history = await this.noteHistoryService.getHistory(note.id, ps.limit, ps.sinceId, ps.untilId);
			if (!note_history) {
				return [];
			}
			return await this.noteHistoryEntityService.packMany(note_history, note, me);
		});
	}
}
