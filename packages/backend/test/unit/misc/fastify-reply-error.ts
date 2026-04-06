/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { FastifyReplyError } from '@/misc/fastify-reply-error.js';

describe('misc:fastify-reply-error', () => {
	test('properties are set correctly', () => {
		const err = new FastifyReplyError(404, 'Not Found');
		expect(err.statusCode).toBe(404);
		expect(err.message).toBe('Not Found');
	});

	test('is instance of Error', () => {
		const err = new FastifyReplyError(500, 'Internal Server Error');
		expect(err).toBeInstanceOf(Error);
	});
});
