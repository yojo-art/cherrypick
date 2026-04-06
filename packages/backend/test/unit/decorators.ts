/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { bindThis } from '@/decorators.js';

describe('decorators', () => {
	test('bindThis preserves method behavior', () => {
		class TestClass {
			value = 42;

			@bindThis
			getValue() {
				return this.value;
			}
		}

		const instance = new TestClass();
		const { getValue } = instance;
		expect(getValue()).toBe(42);
	});
});
