/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { isSafeEventUrl, sanitizeEventMetadata } from '@/misc/sanitize-event-metadata.js';

const DANGEROUS_URLS = [
	'javascript:alert(1)',
	'JaVaScRiPt:alert(1)',
	'  javascript:alert(1)',
	'data:text/html,<script>alert(1)</script>',
	'vbscript:msgbox(1)',
	'file:///etc/passwd',
];

describe('misc:sanitize-event-metadata', () => {
	test('危険なスキームは安全でない', () => {
		for (const url of DANGEROUS_URLS) {
			expect(isSafeEventUrl(url)).toBe(false);
		}
		expect(isSafeEventUrl('')).toBe(false);
		expect(isSafeEventUrl(null)).toBe(false);
		expect(isSafeEventUrl(undefined)).toBe(false);
		expect(isSafeEventUrl(123)).toBe(false);
	});

	test('https は安全', () => {
		expect(isSafeEventUrl('https://example.com/event')).toBe(true);
	});

	test('metadata.url の javascript: は除去される', () => {
		const result = sanitizeEventMetadata({
			'@type': 'Event',
			name: 'poc',
			url: 'javascript:alert(1)',
		} as any);
		expect((result as any).url).toBeUndefined();
		expect((result as any).name).toBe('poc');
	});

	test('metadata.url の https は保持される', () => {
		const result = sanitizeEventMetadata({
			'@type': 'Event',
			url: 'https://example.com/event',
		} as any);
		expect((result as any).url).toBe('https://example.com/event');
	});

	test('offers.url の javascript: は除去される', () => {
		const result = sanitizeEventMetadata({
			'@type': 'Event',
			offers: { '@type': 'Offer', url: 'javascript:alert(1)' },
		} as any);
		expect((result as any).offers.url).toBeUndefined();
	});

	test('organizer.sameAs / performer[].sameAs の javascript: は除去される', () => {
		const result = sanitizeEventMetadata({
			'@type': 'Event',
			organizer: { name: 'org', sameAs: 'javascript:alert(1)' },
			performer: [{ name: 'p1', sameAs: 'javascript:alert(1)' }],
		} as any);
		expect((result as any).organizer.sameAs).toBeUndefined();
		expect((result as any).performer[0].sameAs).toBeUndefined();
		expect((result as any).organizer.name).toBe('org');
	});

	test('入力オブジェクトは変更しない', () => {
		const input = { '@type': 'Event', url: 'javascript:alert(1)' } as any;
		sanitizeEventMetadata(input);
		expect(input.url).toBe('javascript:alert(1)');
	});

	test('null・非オブジェクトはそのまま返す', () => {
		expect(sanitizeEventMetadata(null)).toBeNull();
		expect(sanitizeEventMetadata(undefined)).toBeUndefined();
	});
});
