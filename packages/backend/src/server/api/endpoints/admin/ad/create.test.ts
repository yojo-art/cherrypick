/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { getValidator } from '../../../../../../test/prelude/get-api-validator.js';
import { paramDef } from './create.js';

const VALID = true;
const INVALID = false;

describe('api:admin/ad/create', () => {
	describe('validation', () => {
		const v = getValidator(paramDef);

		test('reject empty', () => expect(v({})).toBe(INVALID));
		test('accept with required fields', () => expect(v({ url: 'test', memo: 'test', place: 'test', priority: 'test', ratio: 1, expiresAt: 1, startsAt: 1, imageUrl: 'test', dayOfWeek: 1 })).toBe(VALID));
	});
});
