/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { emojiCopyPermissions } from '@/types.js';

export const packedEmojiSimpleSchema = {
	type: 'object',
	properties: {
		aliases: {
			type: 'array',
			optional: false, nullable: false,
			items: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
		name: {
			type: 'string',
			optional: false, nullable: false,
		},
		category: {
			type: 'string',
			optional: false, nullable: true,
		},
		url: {
			type: 'string',
			optional: false, nullable: false,
		},
		localOnly: {
			type: 'boolean',
			optional: true, nullable: false,
		},
		isSensitive: {
			type: 'boolean',
			optional: true, nullable: false,
		},
		roleIdsThatCanBeUsedThisEmojiAsReaction: {
			type: 'array',
			optional: true, nullable: false,
			items: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
	},
} as const;

export const packedEmojiDetailedSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
		aliases: {
			type: 'array',
			optional: false, nullable: false,
			items: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
		name: {
			type: 'string',
			optional: false, nullable: false,
		},
		category: {
			type: 'string',
			optional: false, nullable: true,
		},
		host: {
			type: 'string',
			optional: false, nullable: true,
			description: 'The local host is represented with `null`.',
		},
		url: {
			type: 'string',
			optional: false, nullable: false,
		},
		license: {
			type: 'string',
			optional: false, nullable: true,
		},
		isSensitive: {
			type: 'boolean',
			optional: false, nullable: false,
		},
		localOnly: {
			type: 'boolean',
			optional: false, nullable: false,
		},
		roleIdsThatCanBeUsedThisEmojiAsReaction: {
			type: 'array',
			optional: false, nullable: false,
			items: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
		copyPermission: { type: 'string', enum: emojiCopyPermissions, nullable: true, },
		usageInfo: { type: 'string', nullable: true, },
		author: { type: 'string', nullable: true, },
		description: { type: 'string', nullable: true, },
		isBasedOn: { type: 'string', nullable: true, },
		importFrom: { type: 'string', nullable: true, },
	},
} as const;
