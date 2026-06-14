/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
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

const VALID_COPY_PERMISSIONS = ['allow', 'deny', 'conditional'] as const;

function normalizeOptionalString(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function normalizeCopyPermission(value: unknown): 'allow' | 'deny' | 'conditional' | null {
	if (typeof value === 'string' && (VALID_COPY_PERMISSIONS as readonly string[]).includes(value)) {
		return value as typeof VALID_COPY_PERMISSIONS[number];
	}
	return null;
}

function normalizeAliases(keywords: unknown): string[] {
	return Array.isArray(keywords) ? keywords : [];
}

function normalizeLicense(tag: IApEmoji): string | null {
	if (tag.license !== undefined) {
		return normalizeOptionalString(tag.license);
	}
	return normalizeOptionalString(tag._misskey_license?.freeText ?? null);
}

function normalizeAuthor(tag: IApEmoji): string | null {
	return normalizeOptionalString(tag.author ?? tag.creator ?? tag.crator ?? null);
}

export function normalizeApEmojiTag(tag: IApEmoji): NormalizedApEmojiFields {
	return {
		license: normalizeLicense(tag),
		isSensitive: tag.isSensitive ?? false,
		copyPermission: normalizeCopyPermission(tag.copyPermission),
		category: normalizeOptionalString(tag.category),
		aliases: normalizeAliases(tag.keywords),
		usageInfo: normalizeOptionalString(tag.usageInfo),
		author: normalizeAuthor(tag),
		description: normalizeOptionalString(tag.description),
		isBasedOn: normalizeOptionalString(tag.isBasedOn),
	};
}

export function buildApEmojiUpdateFromTag(tag: IApEmoji, normalized: NormalizedApEmojiFields): Partial<NormalizedApEmojiFields> {
	const update: Partial<NormalizedApEmojiFields> = {};

	if (tag.license !== undefined || tag._misskey_license !== undefined) {
		update.license = normalized.license;
	}
	if (tag.isSensitive !== undefined) {
		update.isSensitive = normalized.isSensitive;
	}
	if (tag.copyPermission !== undefined) {
		update.copyPermission = normalized.copyPermission;
	}
	if (tag.category !== undefined) {
		update.category = normalized.category;
	}
	if ('keywords' in tag) {
		update.aliases = normalized.aliases;
	}
	if (tag.usageInfo !== undefined) {
		update.usageInfo = normalized.usageInfo;
	}
	if (tag.author !== undefined || tag.creator !== undefined || tag.crator !== undefined) {
		update.author = normalized.author;
	}
	if (tag.description !== undefined) {
		update.description = normalized.description;
	}
	if (tag.isBasedOn !== undefined) {
		update.isBasedOn = normalized.isBasedOn;
	}

	return update;
}
