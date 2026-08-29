/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * FEP-044f の QuoteAuthorization 承認URIに埋め込むトークンのエンコード/デコード。
 * トークンには「引用元ステータスのURI」と「ローカルノートID」を符号可逆な形式で格納し、
 * DB に承認レコードを持たなくても GET で QuoteAuthorization を再構築できるようにする。
 */

const MAX_TOKEN_LENGTH = 4096;

export type QuoteAuthorizationPayload = {
	interactingObject: string;
	noteId: string;
};

export function encodeQuoteAuthorizationToken(interactingObject: string, noteId: string): string {
	return Buffer.from(JSON.stringify([interactingObject, noteId])).toString('base64url');
}

export function decodeQuoteAuthorizationToken(token: string): QuoteAuthorizationPayload | null {
	if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

	let decoded: unknown;
	try {
		decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
	} catch (e) {
		return null;
	}

	if (!Array.isArray(decoded) || decoded.length !== 2) return null;

	const [interactingObject, noteId] = decoded;
	if (typeof interactingObject !== 'string' || typeof noteId !== 'string') return null;

	return { interactingObject, noteId };
}
