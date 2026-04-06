/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { I18n } from '@/misc/i18n.js';

describe('misc:i18n', () => {
	const locale = {
		greeting: 'Hello',
		nested: {
			message: 'World',
			deep: {
				value: 'Deep',
			},
		},
		withArgs: 'Hello, {name}! You are {age} years old.',
		simple: 'No args here',
	};

	const i18n = new I18n(locale);

	test('locale is accessible', () => {
		expect(i18n.locale).toBe(locale);
	});

	test('simple key', () => {
		expect(i18n.t('greeting')).toBe('Hello');
	});

	test('nested key with dot notation', () => {
		expect(i18n.t('nested.message')).toBe('World');
	});

	test('deeply nested key', () => {
		expect(i18n.t('nested.deep.value')).toBe('Deep');
	});

	test('key with args substitution', () => {
		expect(i18n.t('withArgs', { name: 'Alice', age: '30' })).toBe('Hello, Alice! You are 30 years old.');
	});

	test('missing key returns key itself', () => {
		expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
	});

	test('no args needed', () => {
		expect(i18n.t('simple')).toBe('No args here');
	});
});
