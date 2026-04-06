/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import type { DeliverJobData, InboxJobData, RelationshipJobData, DbJobData, ThinUser } from '@/queue/types.js';

describe('queue/types', () => {
	test('ThinUser type is usable', () => {
		const user: ThinUser = { id: 'test-id' };
		expect(user.id).toBe('test-id');
	});

	test('DeliverJobData type is defined', () => {
		const job: Partial<DeliverJobData> = { to: 'https://example.com/inbox' };
		expect(job.to).toBeDefined();
	});
});
