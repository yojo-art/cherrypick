/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { getValidator } from '../../../../../../prelude/get-api-validator.js';
import { paramDef } from '@/server/api/endpoints/admin/invite/create.js';

const VALID = true;
const INVALID = false;

describe('api:admin/invite/create', () => {
	describe('validation', () => {
		const v = getValidator(paramDef);

		test('accept empty', () => expect(v({})).toBe(VALID));
	});
});
