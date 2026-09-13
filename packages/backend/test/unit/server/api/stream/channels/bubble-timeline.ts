/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { Mocked } from 'vitest';
import { NoteStreamingHidingService } from '@/server/api/stream/NoteStreamingHidingService.js';
import { BubbleTimelineChannel } from '@/server/api/stream/channels/bubble-timeline.js';
import { MetaService } from '@/core/MetaService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DEFAULT_POLICIES, RoleService } from '@/core/RoleService.js';
import type { ChannelRequest } from '@/server/api/stream/channel.js';
import type { Packed } from '@/misc/json-schema.js';
import type { MiMeta } from '@/models/Meta.js';
import type { MiUser } from '@/models/User.js';

describe('BubbleTimelineChannel', () => {
	let metaService: Mocked<MetaService>;
	let roleService: Mocked<RoleService>;
	let noteEntityService: Mocked<NoteEntityService>;
	let noteStreamingHidingService: Mocked<NoteStreamingHidingService>;

	let sendMessageToWs: ReturnType<typeof vi.fn>;
	let subscriber: EventEmitter;

	beforeEach(() => {
		metaService = mockDeep<MetaService>();
		roleService = mockDeep<RoleService>();
		noteEntityService = mockDeep<NoteEntityService>();
		noteStreamingHidingService = mockDeep<NoteStreamingHidingService>();

		metaService.fetch.mockResolvedValue({ bubbleInstances: ['bubble.example'] } as unknown as MiMeta);
		roleService.getUserPolicies.mockResolvedValue({ ...DEFAULT_POLICIES });
		noteStreamingHidingService.processHiding.mockResolvedValue({ shouldSkip: false });

		sendMessageToWs = vi.fn();
		subscriber = new EventEmitter();
	});

	function createChannel(user: MiUser | null): BubbleTimelineChannel {
		const connection = {
			user,
			userProfile: null,
			following: {},
			followingChannels: new Set<string>(),
			mutingChannels: new Set<string>(),
			userIdsWhoMeMuting: new Set<string>(),
			userIdsWhoBlockingMe: new Set<string>(),
			userIdsWhoMeMutingRenotes: new Set<string>(),
			userMutedInstances: new Set<string>(),
			subscriber,
			sendMessageToWs,
		} as unknown as ChannelRequest['connection'];

		return new BubbleTimelineChannel(
			{ id: 'a', connection },
			metaService,
			roleService,
			noteEntityService,
			noteStreamingHidingService,
		);
	}

	function createNote(overrides: Partial<Packed<'Note'>> = {}): Packed<'Note'> {
		return {
			id: 'note1',
			userId: 'remote-user',
			channelId: null,
			renoteId: null,
			visibility: 'public',
			fileIds: [],
			user: {
				id: 'remote-user',
				host: 'bubble.example',
				isCat: false,
				isBot: false,
			},
			...overrides,
		} as unknown as Packed<'Note'>;
	}

	function onNote(channel: BubbleTimelineChannel, note: Packed<'Note'>): Promise<void> {
		return (channel as unknown as { onNote(note: Packed<'Note'>): Promise<void> }).onNote(note);
	}

	test('ゲスト接続でも bubble instance の公開ノートを受信できる', async () => {
		const channel = createChannel(null);
		await channel.init({});

		const note = createNote();
		await expect(onNote(channel, note)).resolves.toBeUndefined();

		expect(noteStreamingHidingService.processHiding).toHaveBeenCalledWith(note, null);
		expect(sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'a',
			type: 'note',
			body: note,
		});
	});

	test('フォローしていないユーザーのノートも受信できる', async () => {
		const user = { id: 'me' } as unknown as MiUser;
		const channel = createChannel(user);
		await channel.init({});

		await onNote(channel, createNote());

		expect(sendMessageToWs).toHaveBeenCalledTimes(1);
	});

	test('bubbleInstances に含まれないホストのノートは受信しない', async () => {
		const channel = createChannel(null);
		await channel.init({});

		const note = createNote({ user: { id: 'remote-user', host: 'other.example' } as unknown as Packed<'Note'>['user'] });
		await onNote(channel, note);

		expect(sendMessageToWs).not.toHaveBeenCalled();
	});

	test('NoteStreamingHidingService が非表示としたノートは受信しない', async () => {
		noteStreamingHidingService.processHiding.mockResolvedValue({ shouldSkip: true });
		const channel = createChannel(null);
		await channel.init({});

		await onNote(channel, createNote());

		expect(sendMessageToWs).not.toHaveBeenCalled();
	});
});
