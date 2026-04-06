/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ChatService } from '@/core/ChatService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ChatService', () => {
	let service: ChatService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ChatService>(ChatService);
	});

	describe('findMessageById', () => {
		test('returns null for nonexistent message', async () => {
			const result = await service.findMessageById('nonexistent-id');
			expect(result).toBeNull();
		});
	});

	describe('findRoomById', () => {
		test('returns null for nonexistent room', async () => {
			const result = await service.findRoomById('nonexistent-id');
			expect(result).toBeNull();
		});
	});

	describe('hasUnreadMessages', () => {
		test('returns false for nonexistent user', async () => {
			const result = await service.hasUnreadMessages('nonexistent-user-id');
			expect(result).toBe(false);
		});
	});

	describe('userHistory', () => {
		test('returns empty array for nonexistent user', async () => {
			const result = await service.userHistory('nonexistent-user-id', 10);
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(0);
		});
	});

	describe('roomHistory', () => {
		test('returns empty array for nonexistent user', async () => {
			const result = await service.roomHistory('nonexistent-user-id', 10);
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(0);
		});
	});

	describe('getUserReadStateMap', () => {
		test('returns empty map for no others', async () => {
			const result = await service.getUserReadStateMap('user-id', []);
			expect(result).toBeDefined();
		});
	});

	describe('getRoomReadStateMap', () => {
		test('returns empty map for no rooms', async () => {
			const result = await service.getRoomReadStateMap('user-id', []);
			expect(result).toBeDefined();
		});
	});

	describe('searchMessages', () => {
		test('returns empty array for no match', async () => {
			const result = await service.searchMessages('user-id', 'nonexistent-query-xyz', 10, {});
			expect(Array.isArray(result)).toBe(true);
		});
	});
});
