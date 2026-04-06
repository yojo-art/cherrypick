/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { getValidator } from '../../../../../../prelude/get-api-validator.js';
import { paramDef } from '@/server/api/endpoints/chat/messages/show.js';

const VALID = true;
const INVALID = false;

describe('api:chat/messages/show', () => {
	describe('validation', () => {
		const v = getValidator(paramDef);

		test('reject empty', () => expect(v({})).toBe(INVALID));
		test('accept with required fields', () => expect(v({ messageId: 'aaaaaaaaaaa' })).toBe(VALID));
	});
});
