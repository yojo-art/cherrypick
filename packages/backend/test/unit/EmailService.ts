/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { EmailService } from '@/core/EmailService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('EmailService', () => {
	let service: EmailService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<EmailService>(EmailService);
	});

	describe('validateEmailForAccount', () => {
		test('invalid format returns format reason', async () => {
			const result = await service.validateEmailForAccount('not-an-email');
			expect(result.available).toBe(false);
			expect(result.reason).toBe('format');
		});

		test('empty string returns format reason', async () => {
			const result = await service.validateEmailForAccount('');
			expect(result.available).toBe(false);
			expect(result.reason).toBe('format');
		});

		test('valid unused email returns available', async () => {
			const result = await service.validateEmailForAccount('unused-test-email-xyz@example.com');
			expect(result.available).toBe(true);
			expect(result.reason).toBeNull();
		});
	});

	describe('sendEmail', () => {
		test('does not throw when email is disabled', async () => {
			// メール送信はmeta.enableEmailがfalseなら何もしない
			await expect(service.sendEmail('test@example.com', 'test', '<p>test</p>', 'test')).resolves.not.toThrow();
		});
	});
});
