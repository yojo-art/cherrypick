/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { StatusError } from '@/misc/status-error.js';

describe('misc:status-error', () => {
	test('basic properties', () => {
		const err = new StatusError('Not Found', 404, 'Not Found');
		expect(err.message).toBe('Not Found');
		expect(err.statusCode).toBe(404);
		expect(err.statusMessage).toBe('Not Found');
		expect(err.name).toBe('StatusError');
	});

	test('client error (4xx)', () => {
		const err = new StatusError('Bad Request', 400);
		expect(err.isClientError).toBe(true);
		expect(err.isRetryable).toBe(false);
	});

	test('server error (5xx) is retryable', () => {
		const err = new StatusError('Internal Server Error', 500);
		expect(err.isClientError).toBe(false);
		expect(err.isRetryable).toBe(true);
	});

	test('429 Too Many Requests is client error but retryable', () => {
		const err = new StatusError('Too Many Requests', 429);
		expect(err.isClientError).toBe(true);
		expect(err.isRetryable).toBe(true);
	});

	test('3xx is not client error and is retryable', () => {
		const err = new StatusError('Redirect', 301);
		expect(err.isClientError).toBe(false);
		expect(err.isRetryable).toBe(true);
	});

	test('statusMessage is optional', () => {
		const err = new StatusError('Error', 500);
		expect(err.statusMessage).toBeUndefined();
	});

	test('is instance of Error', () => {
		const err = new StatusError('Error', 500);
		expect(err).toBeInstanceOf(Error);
	});
});
