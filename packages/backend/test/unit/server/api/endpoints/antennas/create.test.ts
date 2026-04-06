/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { getValidator } from '../../../../../prelude/get-api-validator.js';
import { paramDef } from '@/server/api/endpoints/antennas/create.js';

const VALID = true;
const INVALID = false;

describe('api:antennas/create', () => {
	describe('validation', () => {
		const v = getValidator(paramDef);

		test('reject empty', () => expect(v({})).toBe(INVALID));
		test('accept with required fields', () => expect(v({ name: 'test', src: "home", keywords: [], excludeKeywords: [], users: [], caseSensitive: true, withReplies: true, withFile: true, notify: true })).toBe(VALID));
	});
});
