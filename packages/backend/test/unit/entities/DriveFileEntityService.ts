/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('DriveFileEntityService', () => {
	let service: DriveFileEntityService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<DriveFileEntityService>(DriveFileEntityService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('validateFileName', () => {
		test('valid filename', () => {
			expect(service.validateFileName('test.png')).toBe(true);
		});

		test('empty filename', () => {
			expect(service.validateFileName('')).toBe(false);
		});

		test('whitespace-only filename', () => {
			expect(service.validateFileName('   ')).toBe(false);
		});

		test('filename exceeding 200 chars', () => {
			expect(service.validateFileName('a'.repeat(201))).toBe(false);
		});

		test('filename with backslash', () => {
			expect(service.validateFileName('path\\file.txt')).toBe(false);
		});

		test('filename with slash', () => {
			expect(service.validateFileName('path/file.txt')).toBe(false);
		});

		test('filename with double dots', () => {
			expect(service.validateFileName('../file.txt')).toBe(false);
		});

		test('filename at exactly 200 chars', () => {
			expect(service.validateFileName('a'.repeat(200))).toBe(true);
		});
	});
});
