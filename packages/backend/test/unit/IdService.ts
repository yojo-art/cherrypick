/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Test } from '@nestjs/testing';
import { describe, expect, test, beforeAll } from '@jest/globals';
import { CoreModule } from '@/core/CoreModule.js';
import { IdService } from '@/core/IdService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('IdService', () => {
	let idService: IdService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		idService = app.get<IdService>(IdService);
	});

	describe('gen', () => {
		test('generates a string ID', () => {
			const id = idService.gen();
			expect(typeof id).toBe('string');
			expect(id.length).toBeGreaterThan(0);
		});

		test('generates unique IDs', () => {
			const ids = new Set(Array.from({ length: 100 }, () => idService.gen()));
			expect(ids.size).toBe(100);
		});

		test('generates with specific time', () => {
			const time = Date.now() - 10000;
			const id = idService.gen(time);
			expect(typeof id).toBe('string');
		});

		test('future time falls back to now', () => {
			const futureTime = Date.now() + 1000000;
			const id = idService.gen(futureTime);
			expect(typeof id).toBe('string');
		});
	});

	describe('parse', () => {
		test('parses generated ID', () => {
			const id = idService.gen();
			const parsed = idService.parse(id);
			expect(parsed.date).toBeInstanceOf(Date);
			expect(Math.abs(parsed.date.getTime() - Date.now())).toBeLessThan(5000);
		});
	});

	describe('parseFull', () => {
		test('parses generated ID with full info', () => {
			const id = idService.gen();
			const parsed = idService.parseFull(id);
			expect(typeof parsed.date).toBe('number');
			expect(typeof parsed.additional).toBe('bigint');
		});
	});

	describe('isSafeT', () => {
		test('current time is safe', () => {
			expect(idService.isSafeT(Date.now())).toBe(true);
		});

		test('zero is not safe', () => {
			expect(idService.isSafeT(0)).toBe(false);
		});
	});
});
