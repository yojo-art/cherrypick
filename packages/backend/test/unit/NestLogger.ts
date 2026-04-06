/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { NestLogger } from '@/NestLogger.js';

describe('NestLogger', () => {
	const logger = new NestLogger();

	test('log does not throw', () => {
		expect(() => logger.log('test message', 'TestContext')).not.toThrow();
	});

	test('error does not throw', () => {
		expect(() => logger.error('test error', 'TestContext')).not.toThrow();
	});

	test('warn does not throw', () => {
		expect(() => logger.warn('test warning', 'TestContext')).not.toThrow();
	});

	test('debug does not throw', () => {
		expect(() => logger.debug?.('test debug', 'TestContext')).not.toThrow();
	});

	test('verbose does not throw', () => {
		expect(() => logger.verbose?.('test verbose', 'TestContext')).not.toThrow();
	});
});
