/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { IApEmoji } from '@/core/activitypub/type.js';

export type NormalizedApEmojiFields = {
	license: string | null;
	isSensitive: boolean;
	copyPermission: 'allow' | 'deny' | 'conditional' | null;
	category: string | null;
	aliases: string[];
	usageInfo: string | null;
	author: string | null;
	description: string | null;
	isBasedOn: string | null;
};

export function normalizeApEmojiTag(tag: IApEmoji): NormalizedApEmojiFields {
	const str = (value: unknown): string | null => typeof value === 'string' ? value : null;

	return {
		license: tag.license !== undefined
			? str(tag.license)
			: str(tag._misskey_license?.freeText ?? null),
		isSensitive: tag.isSensitive ?? false,
		copyPermission: (tag.copyPermission === 'allow' || tag.copyPermission === 'deny' || tag.copyPermission === 'conditional')
			? tag.copyPermission
			: null,
		category: str(tag.category),
		aliases: Array.isArray(tag.keywords) ? tag.keywords : [],
		usageInfo: str(tag.usageInfo),
		author: str(tag.author ?? tag.creator ?? null),
		description: str(tag.description),
		isBasedOn: str(tag.isBasedOn),
	};
}
