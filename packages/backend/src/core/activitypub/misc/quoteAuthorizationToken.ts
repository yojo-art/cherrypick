/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * FEP-044f の QuoteAuthorization 承認URIに埋め込むランダムトークン生成。
 * 承認レコードは DB に保持し、トークンは推測不可能なランダム値とする。
 */

import { randomBytes } from 'crypto';

export const QUOTE_AUTHORIZATION_TOKEN_BYTES = 32;

export function generateQuoteAuthorizationToken(): string {
	return randomBytes(QUOTE_AUTHORIZATION_TOKEN_BYTES).toString('base64url');
}
