/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { QueryService } from '@/core/QueryService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { DI } from '@/di-symbols.js';
import type { NotesRepository } from '@/models/_.js';

describe('QueryService', () => {
	let service: QueryService;
	let notesRepository: NotesRepository;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<QueryService>(QueryService);
		notesRepository = app.get<NotesRepository>(DI.notesRepository);
	});

	describe('makePaginationQuery', () => {
		test('returns query builder without pagination params', () => {
			const qb = notesRepository.createQueryBuilder('note');
			const result = service.makePaginationQuery(qb);
			expect(result).toBeDefined();
		});

		test('with untilId', () => {
			const qb = notesRepository.createQueryBuilder('note');
			const result = service.makePaginationQuery(qb, undefined, 'zzzzzzzzzzz');
			expect(result).toBeDefined();
		});

		test('with sinceId', () => {
			const qb = notesRepository.createQueryBuilder('note');
			const result = service.makePaginationQuery(qb, 'aaaaaaaaaaa');
			expect(result).toBeDefined();
		});

		test('with both sinceId and untilId', () => {
			const qb = notesRepository.createQueryBuilder('note');
			const result = service.makePaginationQuery(qb, 'aaaaaaaaaaa', 'zzzzzzzzzzz');
			expect(result).toBeDefined();
		});
	});

	describe('generateVisibilityQuery', () => {
		test('without me', () => {
			const qb = notesRepository.createQueryBuilder('note');
			expect(() => service.generateVisibilityQuery(qb)).not.toThrow();
		});

		test('with me', () => {
			const qb = notesRepository.createQueryBuilder('note');
			expect(() => service.generateVisibilityQuery(qb, { id: 'test-user' })).not.toThrow();
		});

		test('with search option', () => {
			const qb = notesRepository.createQueryBuilder('note');
			expect(() => service.generateVisibilityQuery(qb, null, { search: true })).not.toThrow();
		});
	});

	describe('generateBlockedHostQueryForNote', () => {
		test('does not throw', () => {
			const qb = notesRepository.createQueryBuilder('note');
			expect(() => service.generateBlockedHostQueryForNote(qb)).not.toThrow();
		});

		test('with excludeAuthor', () => {
			const qb = notesRepository.createQueryBuilder('note');
			expect(() => service.generateBlockedHostQueryForNote(qb, true)).not.toThrow();
		});
	});

	describe('generateSuspendedUserQueryForNote', () => {
		test('does not throw', () => {
			const qb = notesRepository.createQueryBuilder('note');
			expect(() => service.generateSuspendedUserQueryForNote(qb)).not.toThrow();
		});

		test('with excludeAuthor', () => {
			const qb = notesRepository.createQueryBuilder('note');
			expect(() => service.generateSuspendedUserQueryForNote(qb, true)).not.toThrow();
		});
	});
});
