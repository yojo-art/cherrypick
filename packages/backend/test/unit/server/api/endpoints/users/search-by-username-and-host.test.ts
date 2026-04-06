/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { getValidator } from '../../../../../prelude/get-api-validator.js';
import { paramDef } from '@/server/api/endpoints/users/search-by-username-and-host.js';

const VALID = true;
const INVALID = false;

describe('api:users/search-by-username-and-host', () => {
	describe('validation', () => {
		const v = getValidator(paramDef);

		test('reject empty', () => expect(v({})).toBe(INVALID));
		test('validator is a function', () => expect(typeof v).toBe('function'));
	});
});
