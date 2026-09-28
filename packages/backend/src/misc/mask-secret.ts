/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { META_SECRET_FIELDS } from './meta-secret-fields.js';

const MASKED_SECRET = '*'.repeat(32);

export function maskSecretValue(value: string | null): string | null {
	if (value === null) return null;
	if (value === '') return '';
	return MASKED_SECRET;
}

export function maskMetaSecrets(meta: unknown): unknown {
	if (!meta || typeof meta !== 'object') return meta;
	const masked = { ...meta } as Record<string, unknown>;
	for (const key of META_SECRET_FIELDS) {
		if (key in masked && typeof masked[key] === 'string') {
			masked[key] = maskSecretValue(masked[key]);
		}
	}
	return masked;
}
