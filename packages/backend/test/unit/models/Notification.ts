/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import type { MiNotification } from '@/models/Notification.js';

describe('models:Notification', () => {
	test('MiNotification type is defined', () => {
		// Type-level test: verify the type is importable and usable
		const notification: MiNotification = {
			type: 'follow',
			id: 'test-id',
			createdAt: new Date().toISOString(),
			notifierId: 'notifier-id',
		};
		expect(notification.type).toBe('follow');
	});
});
