/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ClipService } from '@/core/ClipService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ClipService', () => {
	let service: ClipService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ClipService>(ClipService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('create', () => {
		// DB操作のため簡易テストのみ
		test('method exists', () => {
			expect(typeof service.create).toBe('function');
		});
	});

	describe('delete', () => {
		test('method exists', () => {
			expect(typeof service.delete).toBe('function');
		});
	});

	describe('addNote', () => {
		test('method exists', () => {
			expect(typeof service.addNote).toBe('function');
		});
	});

	describe('removeNote', () => {
		test('method exists', () => {
			expect(typeof service.removeNote).toBe('function');
		});
	});
});
