/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApOutboxFetchService } from '@/core/activitypub/models/ApOutboxFetchService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['federation'],

	description: 'リモートユーザの投稿を取得します',
	requireCredential: true,
	kind: 'read:account',

	limit: {
		duration: ms('1hour'),
		max: 30,
	},

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '0e30e164-e32e-4aae-9f82-8cca651fbe3f',
		},
		isLocalUser: {
			message: 'is Local user.',
			code: 'IS_LOCAL_USER',
			id: '90a7a756-9064-4c50-8c69-3f7f3fa3ef07',
		},
		outboxUndefined: {
			message: 'outbox undefined this user',
			code: 'OUTBOX_UNDEFINED_THIS_USER',
			id: '890ecef7-ad5a-487d-a201-b49a54059c90',
		},
		outboxFirstPageUndefined: {
			message: 'outbox first page undefined this user',
			code: 'OUTBOX_FIRST_PAGE_UNDEFINED_THIS_USER',
			id: 'e1f29e66-86a9-4fdc-9be6-63d4587dc350',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: {
			type: 'string',
			format: 'misskey:id',
			description: 'Outbox取得対象ユーザのローカルのユーザID',
		 },
		wait: {
			type: 'boolean',
			default: false,
			description: 'Outboxの取得が終わるまで待ちます',
		},
		includeAnnounce: {
			type: 'boolean',
			default: false,
			description: 'Outbox取得の際にRenoteも対象にします',
		},
		//skip: { type: 'integer', minimum: 1, default: 0 },
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
					await this.apOutboxFetchService.fetchOutbox(ps.userId, ps.includeAnnounce);
				} catch (err) {
					if (err instanceof IdentifiableError) {
						if (err.id === '3fc5a089-cab4-48db-b9f3-f220574b3c0a') throw new ApiError(meta.errors.noSuchUser);
						if (err.id === '67070303-177c-4600-af93-b26a7ab889c6') throw new ApiError(meta.errors.isLocalUser);
						if (err.id === 'e7a2e510-a8ce-40e9-b1e6-c007bacdc89f') throw new ApiError(meta.errors.outboxUndefined);
						//if (err.id === 'b27090c8-8a68-4189-a445-14591c32a89c')
						//if (err.id === '0be2f5a1-2345-46d8-b8c3-430b111c68d3')
						if (err.id === 'a723c2df-0250-4091-b5fc-e3a7b36c7b61') throw new ApiError(meta.errors.outboxFirstPageUndefined);
						//if (err.id === '6603433f-99db-4134-980c-48705ae57ab8')
						//if (err.id === '2a05bb06-f38c-4854-af6f-7fd5e87c98ee')
					}
					throw (err);
				}
			} else {
				this.apOutboxFetchService.fetchOutbox(ps.userId, ps.includeAnnounce);
			}
		});
	}
}
