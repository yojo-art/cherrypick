/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApOutboxFetchService } from '@/core/activitypub/models/ApOutboxFetchService.js'
import { ApiError } from '../../error.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';

export const meta = {
	tags: ['federation'],

	requireCredential: true,
	kind: 'read:account',

	limit: {
		duration: ms('1hour'),
		max: 30,
	},

	errors: {
		noSuchObject: {
			message: 'No such object.',
			code: 'NO_SUCH_OBJECT',
			id: 'dc94d745-1262-4e63-a17d-fecaa57efc82',
		},
	},

	res: {
		optional: false, nullable: false,
				type: 'object',
				properties: {},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		wait: {type: 'boolean', default: false},
		withAnounce: {type: 'boolean', default: false},
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private apOutboxFetchService: ApOutboxFetchService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.wait) {
				try {
				ps.withAnounce ?
				await this.apOutboxFetchService.fetchOutboxWithAnnounce(ps.userId):
				await this.apOutboxFetchService.fetchOutbox(ps.userId);
				} catch (err) {
					if (err instanceof IdentifiableError) {
						if (err.e)
						throw new ApiError(meta.errors.noSuchObject)
					}
				}
			} else {
				ps.withAnounce ?
				this.apOutboxFetchService.fetchOutboxWithAnnounce(ps.userId):
				this.apOutboxFetchService.fetchOutbox(ps.userId);
			}
		});
	}
}
