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

/**
 * TODO(#1049): 未実装スタブ。現状の extractEmojis と同じく正規化しない。
 */
export function normalizeApEmojiTag(tag: IApEmoji): NormalizedApEmojiFields {
	return {
		license: (tag.license ?? tag._misskey_license?.freeText ?? null),
		isSensitive: tag.isSensitive ?? false,
		copyPermission: tag.copyPermission ?? null,
		category: tag.category ?? null,
		aliases: tag.keywords ?? null as unknown as string[],
		usageInfo: tag.usageInfo ?? null,
		author: tag.author ?? null,
		description: tag.description ?? null,
		isBasedOn: tag.isBasedOn ?? null,
	};
}
