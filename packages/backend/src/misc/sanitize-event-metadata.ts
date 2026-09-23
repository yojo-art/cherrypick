/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { checkHttps } from '@/misc/check-https.js';

const MAX_URL_LENGTH = 2048;

/**
 * event.metadata 内の URL として安全か (http/https のみ許可)。
 * `checkHttps` と同じ基準 (production では https のみ) を使う。
 * `javascript:` / `data:` / `vbscript:` / `file:` 等はすべて false。
 */
export function isSafeEventUrl(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return false;
	return checkHttps(trimmed);
}

function sanitizeUrl(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return undefined;
	return checkHttps(trimmed) ? trimmed : undefined;
}

/**
 * event.metadata から危険な URL を除去したコピーを返す。
 * 対象: `url` / `offers.url` / `organizer.sameAs` / `performer[].sameAs`。
 * それ以外のキー (テキスト系) には触らない。入力は変更しない。
 */
export function sanitizeEventMetadata<T>(metadata: T): T {
	if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) {
		return metadata;
	}

	const result: Record<string, unknown> = { ...(metadata as Record<string, unknown>) };

	const url = sanitizeUrl(result.url);
	if (url === undefined) {
		delete result.url;
	} else {
		result.url = url;
	}

	const offers = result.offers;
	if (offers != null && typeof offers === 'object' && !Array.isArray(offers)) {
		const offersCopy: Record<string, unknown> = { ...(offers as Record<string, unknown>) };
		const offersUrl = sanitizeUrl(offersCopy.url);
		if (offersUrl === undefined) {
			delete offersCopy.url;
		} else {
			offersCopy.url = offersUrl;
		}
		result.offers = offersCopy;
	}

	const organizer = result.organizer;
	if (organizer != null && typeof organizer === 'object' && !Array.isArray(organizer)) {
		const organizerCopy: Record<string, unknown> = { ...(organizer as Record<string, unknown>) };
		const sameAs = sanitizeUrl(organizerCopy.sameAs);
		if (sameAs === undefined) {
			delete organizerCopy.sameAs;
		} else {
			organizerCopy.sameAs = sameAs;
		}
		result.organizer = organizerCopy;
	}

	if (Array.isArray(result.performer)) {
		result.performer = result.performer.map((item) => {
			if (item != null && typeof item === 'object' && !Array.isArray(item)) {
				const copy: Record<string, unknown> = { ...(item as Record<string, unknown>) };
				const sameAs = sanitizeUrl(copy.sameAs);
				if (sameAs === undefined) {
					delete copy.sameAs;
				} else {
					copy.sameAs = sameAs;
				}
				return copy;
			}
			return item;
		});
	}

	return result as T;
}
