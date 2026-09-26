/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const packedAnnouncementReactionSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
		createdAt: {
			type: 'string',
			optional: false, nullable: false,
			format: 'date-time',
		},
		user: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'UserLite',
		},
		type: {
			type: 'string',
			optional: false, nullable: false,
		},
	},
} as const;
