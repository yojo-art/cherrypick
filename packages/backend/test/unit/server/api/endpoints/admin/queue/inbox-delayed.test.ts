/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { getValidator } from '../../../../../../prelude/get-api-validator.js';
import { paramDef } from '@/server/api/endpoints/admin/queue/inbox-delayed.js';

const VALID = true;
const INVALID = false;

describe('api:admin/queue/inbox-delayed', () => {
	describe('validation', () => {
		const v = getValidator(paramDef);

		test('accept empty', () => expect(v({})).toBe(VALID));
		test('validator is a function', () => expect(typeof v).toBe('function'));
	});
});
