/*
 * SPDX-FileCopyrightText: syuilo and misskey-project 1673beta
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ApiError } from '../../error.js';

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
		'canNotClearThisNotificationType': {
			message: 'Cannot clear this notification type',
			code: 'CANNOT_CLEAR_THIS_NOTIFICATION_TYPE',
			id: '768fc8ca-87b9-4482-83d6-d53f8282c2b7',
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
				if (err instanceof Error || typeof err === 'string') {
					console.error(err);
				}
				if (err instanceof IdentifiableError) {
					if (err.id === 'd09b1ffa-1a59-4a42-8a3d-02d257d78df7') throw new ApiError(meta.errors.canNotClearThisNotificationType);
				}
			}
		});
	}
}
