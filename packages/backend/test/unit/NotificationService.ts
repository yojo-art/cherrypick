/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { NotificationService } from '@/core/NotificationService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('NotificationService', () => {
	let service: NotificationService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<NotificationService>(NotificationService);
	});

	describe('readAllNotification', () => {
		test('does not throw for nonexistent user', async () => {
			await expect(service.readAllNotification('nonexistent-user-id')).resolves.not.toThrow();
		});

		test('with force=true', async () => {
			await expect(service.readAllNotification('nonexistent-user-id', true)).resolves.not.toThrow();
		});
	});

	describe('flushAllNotifications', () => {
		test('does not throw for nonexistent user', async () => {
			await expect(service.flushAllNotifications('nonexistent-user-id')).resolves.not.toThrow();
		});
	});

	describe('getNotifications', () => {
		test('returns empty array for nonexistent user', async () => {
			const result = await service.getNotifications('nonexistent-user-id', { limit: 10 });
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(0);
		});

		test('with includeTypes filter', async () => {
			const result = await service.getNotifications('nonexistent-user-id', {
				limit: 10,
				includeTypes: ['follow'],
			});
			expect(Array.isArray(result)).toBe(true);
		});

		test('with excludeTypes filter', async () => {
			const result = await service.getNotifications('nonexistent-user-id', {
				limit: 10,
				excludeTypes: ['follow'],
			});
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('dispose', () => {
		test('does not throw', () => {
			expect(() => service.dispose()).not.toThrow();
		});
	});

	describe('onApplicationShutdown', () => {
		test('does not throw', () => {
			expect(() => service.onApplicationShutdown()).not.toThrow();
		});
	});
});
