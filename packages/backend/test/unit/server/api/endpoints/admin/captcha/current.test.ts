/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { getValidator } from '../../../../../../prelude/get-api-validator.js';
import { paramDef } from '@/server/api/endpoints/admin/captcha/current.js';

const VALID = true;
const INVALID = false;

describe('api:admin/captcha/current', () => {
	describe('validation', () => {
		const v = getValidator(paramDef);

		test('accept empty', () => expect(v({})).toBe(VALID));
		test('validator is a function', () => expect(typeof v).toBe('function'));
	});
});
