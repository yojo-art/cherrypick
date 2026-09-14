/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { afterAll, beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import type { Mocked } from 'vitest';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'vitest-mock-extended';
import type { TestingModule } from '@nestjs/testing';
import { NoteUpdateService } from '@/core/NoteUpdateService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { RelayService } from '@/core/RelayService.js';
import { DI } from '@/di-symbols.js';
import { MiNote } from '@/models/Note.js';
import type { MiLocalUser, MiRemoteUser } from '@/models/User.js';

describe('NoteUpdateService', () => {
	let app: TestingModule;
	let noteUpdateService: NoteUpdateService;
	let apDeliverManagerService: Mocked<ApDeliverManagerService>;
	let relayService: Mocked<RelayService>;
	const mockUsersRepository = { find: vi.fn() };
	const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

	const user = { id: 'alice', host: null } as unknown as Pick<MiLocalUser, 'id' | 'host'>;
	const remoteUser = {
		id: 'bob-id',
		uri: 'https://b.test/users/bob',
		host: 'b.test',
	} as unknown as MiRemoteUser;

	const baseNote: MiNote = {
		id: 'some-note-id',
		updatedAt: null,
		updatedAtHistory: null,
		deleteAt: null,
		replyId: null,
		reply: null,
		renoteId: null,
		renote: null,
		threadId: null,
		hasEvent: false,
		text: 'some text',
		name: null,
		cw: null,
		userId: 'alice',
		user: null,
		localOnly: false,
		reactionAcceptance: null,
		renoteCount: 0,
		repliesCount: 0,
		clippedCount: 0,
		pageCount: 0,
		reactions: {},
		visibility: 'public',
		searchableBy: 'public',
		uri: null,
		url: null,
		fileIds: [],
		attachedFileTypes: [],
		visibleUserIds: [],
		mentions: [],
		mentionedRemoteUsers: JSON.stringify([{ uri: 'https://b.test/users/bob', username: 'bob', host: 'b.test' }]),
		reactionAndUserPairCache: [],
		emojis: [],
		tags: [],
		hasPoll: false,
		channelId: null,
		channel: null,
		userHost: null,
		replyUserId: null,
		replyUserHost: null,
		renoteUserId: null,
		renoteUserHost: null,
		renoteChannelId: null,
	};

	beforeAll(async () => {
		app = await Test.createTestingModule({
			providers: [
				NoteUpdateService,
				{ provide: DI.config, useValue: {} },
				{ provide: DI.db, useValue: {} },
				{ provide: DI.usersRepository, useValue: mockUsersRepository },
				{ provide: DI.notesRepository, useValue: {} },
				{ provide: DI.channelsRepository, useValue: {} },
			],
		})
			.useMocker((token) => {
				if (typeof token === 'function') {
					return mockDeep<typeof token>();
				}
			})
			.compile();

		app.enableShutdownHooks();

		noteUpdateService = app.get<NoteUpdateService>(NoteUpdateService);
		apDeliverManagerService = app.get<ApDeliverManagerService>(ApDeliverManagerService) as Mocked<ApDeliverManagerService>;
		relayService = app.get<RelayService>(RelayService) as Mocked<RelayService>;

		mockUsersRepository.find.mockResolvedValue([remoteUser]);
	});

	afterAll(async () => {
		logSpy.mockRestore();
		await app.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('public ノートの編集はフォロワーとリレーとメンション先に配送される', async () => {
		await (noteUpdateService as any)['deliverToConcerned'](
			user,
			{ ...baseNote, visibility: 'public' },
			{ type: 'Update' },
		);

		expect(apDeliverManagerService.deliverToFollowers).toHaveBeenCalledTimes(1);
		expect(relayService.deliverToRelays).toHaveBeenCalledTimes(1);
		expect(apDeliverManagerService.deliverToUser).toHaveBeenCalledTimes(1);
		expect(apDeliverManagerService.deliverToUser).toHaveBeenCalledWith(user, { type: 'Update' }, remoteUser);
		expect(logSpy).not.toHaveBeenCalled();
	});

	test('home ノートの編集はリレーに配送されない', async () => {
		await (noteUpdateService as any)['deliverToConcerned'](
			user,
			{ ...baseNote, visibility: 'home' },
			{ type: 'Update' },
		);

		expect(apDeliverManagerService.deliverToFollowers).toHaveBeenCalledTimes(1);
		expect(relayService.deliverToRelays).not.toHaveBeenCalled();
		expect(apDeliverManagerService.deliverToUser).toHaveBeenCalledTimes(1);
	});

	test('followers ノートの編集はリレーに配送されない', async () => {
		await (noteUpdateService as any)['deliverToConcerned'](
			user,
			{ ...baseNote, visibility: 'followers' },
			{ type: 'Update' },
		);

		expect(apDeliverManagerService.deliverToFollowers).toHaveBeenCalledTimes(1);
		expect(relayService.deliverToRelays).not.toHaveBeenCalled();
		expect(apDeliverManagerService.deliverToUser).toHaveBeenCalledTimes(1);
	});

	test('specified ノートの編集はフォロワーとリレーに配送されない', async () => {
		await (noteUpdateService as any)['deliverToConcerned'](
			user,
			{ ...baseNote, visibility: 'specified', visibleUserIds: [remoteUser.id] },
			{ type: 'Update' },
		);

		expect(apDeliverManagerService.deliverToFollowers).not.toHaveBeenCalled();
		expect(relayService.deliverToRelays).not.toHaveBeenCalled();
		expect(apDeliverManagerService.deliverToUser).toHaveBeenCalledTimes(1);
		expect(apDeliverManagerService.deliverToUser).toHaveBeenCalledWith(user, { type: 'Update' }, remoteUser);
		expect(logSpy).not.toHaveBeenCalled();
	});
});
