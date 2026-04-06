/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { getValidator } from '../../../../../test/prelude/get-api-validator.js';
import { paramDef } from './show.js';

const VALID = true;
const INVALID = false;

describe('api:ap/show', () => {
	describe('validation', () => {
		const v = getValidator(paramDef);

		test('reject empty', () => expect(v({})).toBe(INVALID));
		test('accept with required fields', () => expect(v({ uri: 'test' })).toBe(VALID));
	});
});
