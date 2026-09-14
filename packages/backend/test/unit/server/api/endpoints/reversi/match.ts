/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { describe, expect, test } from 'vitest';
import { meta } from '@/server/api/endpoints/reversi/match.js';
import { ApiError } from '@/server/api/error.js';

describe('reversi/match endpoint', () => {
	test('has the expected rate limit metadata', () => {
		expect(meta.limit).toEqual({
			duration: ms('1hour'),
			max: 120,
			minInterval: 3000,
		});
	});

	test('uses only the declared structured API errors', () => {
		expect(new ApiError(meta.errors.noSuchUser)).toMatchObject({ code: 'NO_SUCH_USER' });
		expect(new ApiError(meta.errors.isYourself)).toMatchObject({ code: 'TARGET_IS_YOURSELF' });
	});
});
