/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { moderationLogTypes, notificationTypes, groupedNotificationTypes, obsoleteNotificationTypes } from '@/types.js';

describe('types', () => {
	test('moderationLogTypes is an array', () => {
		expect(Array.isArray(moderationLogTypes)).toBe(true);
		expect(moderationLogTypes.length).toBeGreaterThan(0);
	});

	test('notificationTypes is an array', () => {
		expect(Array.isArray(notificationTypes)).toBe(true);
		expect(notificationTypes.length).toBeGreaterThan(0);
	});

	test('groupedNotificationTypes is an array', () => {
		expect(Array.isArray(groupedNotificationTypes)).toBe(true);
	});

	test('obsoleteNotificationTypes is an array', () => {
		expect(Array.isArray(obsoleteNotificationTypes)).toBe(true);
	});
});
