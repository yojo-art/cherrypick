/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, jest } from '@jest/globals';
import { handleRequestRedirectToOmitSearch } from '@/misc/fastify-hook-handlers.js';

describe('misc:fastify-hook-handlers', () => {
	describe('handleRequestRedirectToOmitSearch', () => {
		test('redirects when URL has query string', () => {
			const redirect = jest.fn();
			const request = { url: '/path?query=1' } as any;
			const reply = { redirect } as any;
			const done = jest.fn();

			handleRequestRedirectToOmitSearch(request, reply, done);

			expect(redirect).toHaveBeenCalledWith('/path', 301);
			expect(done).toHaveBeenCalled();
		});

		test('does not redirect when URL has no query string', () => {
			const redirect = jest.fn();
			const request = { url: '/path' } as any;
			const reply = { redirect } as any;
			const done = jest.fn();

			handleRequestRedirectToOmitSearch(request, reply, done);

			expect(redirect).not.toHaveBeenCalled();
			expect(done).toHaveBeenCalled();
		});
	});
});
