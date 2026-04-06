/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { DevNull } from '@/misc/dev-null.js';

describe('misc:dev-null', () => {
	test('can be instantiated', () => {
		const devNull = new DevNull();
		expect(devNull).toBeInstanceOf(DevNull);
	});

	test('accepts write without error', (done) => {
		const devNull = new DevNull();
		devNull.write(Buffer.from('test data'), 'utf-8', (err) => {
			expect(err).toBeFalsy();
			devNull.destroy();
			done();
		});
	});
});
