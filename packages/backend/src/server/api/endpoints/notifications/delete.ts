/*
 * SPDX-FileCopyrightText: syuilo and misskey-project 1673beta
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ApiError } from '../../error.js';
import { IdentifiableError } from "@/misc/identifiable-error.js";

export const meta = {
	tags: ['notification', 'account'],

	requireCredential: true,

	kind: 'write:notifications',

	errors: {
		'noSuchNotification': {
			message: 'No such notification',
			code: 'NO_SUCH_NOTIFICATION',
			id: '4818a20e-3d02-11ef-9c7c-63e2e6b43b02',
		},
		'canNotDeleteLoginNotification': {
			message: 'cannot Delete Login Notification',
			code: 'CANNOT_DELETE_LOGIN_NOTIFICATION',
			id: '7b2eb49e-fd4c-482d-9ea8-3874450b39bd',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		notificationId: { type: 'string', format: 'misskey:id' },
	},
	required: ['notificationId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const res = await this.notificationService.deleteNotification(me.id, ps.notificationId);
				if (!res) {
					throw new ApiError(meta.errors.noSuchNotification);
				}
			} catch (err) {
				if (err instanceof ApiError) throw err;
				if (err instanceof IdentifiableError) {
					if (err.id === '32f27781-daf0-4b7b-8b23-ca6d4616952d') throw new ApiError(meta.errors.canNotDeleteLoginNotification);
					throw new ApiError();
				}
			}
		});
	}
}
