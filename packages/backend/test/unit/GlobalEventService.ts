/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('GlobalEventService', () => {
	let globalEventService: GlobalEventService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		globalEventService = app.get<GlobalEventService>(GlobalEventService);
	});

	test('publishInternalEvent does not throw', () => {
		expect(() => {
			globalEventService.publishInternalEvent('localUserUpdated', { id: 'test-user-id' } as any);
		}).not.toThrow();
	});

	test('publishBroadcastStream does not throw', () => {
		expect(() => {
			globalEventService.publishBroadcastStream('emojiAdded', { emoji: {} } as any);
		}).not.toThrow();
	});

	test('publishMainStream does not throw', () => {
		expect(() => {
			globalEventService.publishMainStream('test-user-id', 'readAllNotifications');
		}).not.toThrow();
	});

	test('publishDriveStream does not throw', () => {
		expect(() => {
			globalEventService.publishDriveStream('test-user-id', 'fileCreated', {} as any);
		}).not.toThrow();
	});

	test('publishNoteStream does not throw', () => {
		expect(() => {
			globalEventService.publishNoteStream(
				{ id: 'note-id', userId: 'user-id', visibility: 'public', visibleUserIds: [] } as any,
				'deleted',
				{ deletedAt: new Date() },
			);
		}).not.toThrow();
	});

	test('publishUserListStream does not throw', () => {
		expect(() => {
			globalEventService.publishUserListStream('list-id', 'userAdded', {} as any);
		}).not.toThrow();
	});

	test('publishAntennaStream does not throw', () => {
		expect(() => {
			globalEventService.publishAntennaStream('antenna-id', 'note', {} as any);
		}).not.toThrow();
	});

	test('publishRoleTimelineStream does not throw', () => {
		expect(() => {
			globalEventService.publishRoleTimelineStream('role-id', 'note', {} as any);
		}).not.toThrow();
	});

	test('publishNotesStream does not throw', () => {
		expect(() => {
			globalEventService.publishNotesStream({} as any);
		}).not.toThrow();
	});

	test('publishAdminStream does not throw', () => {
		expect(() => {
			globalEventService.publishAdminStream('user-id', 'newAbuseUserReport', {
				id: 'report-id',
				targetUserId: 'target-id',
				reporterId: 'reporter-id',
				comment: 'test',
			});
		}).not.toThrow();
	});

	test('publishChatUserStream does not throw', () => {
		expect(() => {
			globalEventService.publishChatUserStream('from-id', 'to-id', 'message', {} as any);
		}).not.toThrow();
	});

	test('publishChatRoomStream does not throw', () => {
		expect(() => {
			globalEventService.publishChatRoomStream('room-id', 'message', {} as any);
		}).not.toThrow();
	});

	test('publishReversiStream does not throw', () => {
		expect(() => {
			globalEventService.publishReversiStream('user-id', 'matched', { game: {} } as any);
		}).not.toThrow();
	});

	test('publishReversiGameStream does not throw', () => {
		expect(() => {
			globalEventService.publishReversiGameStream('game-id', 'started', { game: {} } as any);
		}).not.toThrow();
	});
});
