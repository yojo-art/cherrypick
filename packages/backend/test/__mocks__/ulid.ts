/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as crypto from 'node:crypto';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(now: number, len: number): string {
	let str = '';
	for (let i = len; i > 0; i--) {
		const mod = now % ENCODING.length;
		str = ENCODING[mod] + str;
		now = (now - mod) / ENCODING.length;
	}
	return str;
}

function encodeRandom(len: number): string {
	const bytes = crypto.randomBytes(len);
	let str = '';
	for (let i = 0; i < len; i++) {
		str += ENCODING[bytes[i] % ENCODING.length];
	}
	return str;
}

export function ulid(seedTime?: number): string {
	const time = seedTime ?? Date.now();
	return encodeTime(time, 10) + encodeRandom(16);
}
