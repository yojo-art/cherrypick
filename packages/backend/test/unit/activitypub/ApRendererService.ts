/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('ApRendererService', () => {
	let service: ApRendererService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<ApRendererService>(ApRendererService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('renderAccept', () => {
		test('renders Accept activity', () => {
			const result = service.renderAccept('https://example.com/follow/1', { id: 'user1', host: null });
			expect(result.type).toBe('Accept');
			expect(result.object).toBe('https://example.com/follow/1');
		});
	});

	describe('renderBlock', () => {
		test('renders Block activity', () => {
			const blocking = {
				id: 'block1',
				blockerId: 'user1',
				blockeeId: 'user2',
				blocker: { id: 'user1', host: null, uri: null } as any,
				blockee: { id: 'user2', host: 'remote.example.com', uri: 'https://remote.example.com/users/user2' } as any,
			} as any;
			const result = service.renderBlock(blocking);
			expect(result.type).toBe('Block');
		});
	});

	describe('renderDelete', () => {
		test('renders Delete activity', () => {
			const result = service.renderDelete({ type: 'Tombstone', id: 'https://example.com/notes/1' } as any, { id: 'user1', host: null });
			expect(result.type).toBe('Delete');
		});
	});

	describe('renderHashtag', () => {
		test('renders hashtag', () => {
			const result = service.renderHashtag('test');
			expect(result.type).toBe('Hashtag');
			expect(result.name).toBe('#test');
		});
	});

	describe('renderTombstone', () => {
		test('renders Tombstone', () => {
			const result = service.renderTombstone('https://example.com/notes/1');
			expect(result.type).toBe('Tombstone');
			expect(result.id).toBe('https://example.com/notes/1');
		});
	});

	describe('renderUndo', () => {
		test('renders Undo activity', () => {
			const result = service.renderUndo({ type: 'Follow' } as any, { id: 'user1' });
			expect(result.type).toBe('Undo');
			expect(result.object).toEqual({ type: 'Follow' });
		});
	});

	describe('renderUpdate', () => {
		test('renders Update activity', () => {
			const result = service.renderUpdate({ type: 'Person' } as any, { id: 'user1' });
			expect(result.type).toBe('Update');
		});
	});

	describe('renderReject', () => {
		test('renders Reject activity', () => {
			const result = service.renderReject('https://example.com/follow/1', { id: 'user1' });
			expect(result.type).toBe('Reject');
			expect(result.object).toBe('https://example.com/follow/1');
		});
	});

	describe('addContext', () => {
		test('adds @context to activity', () => {
			const activity = { type: 'Create', id: 'test' } as any;
			const result = service.addContext(activity);
			expect(result['@context']).toBeDefined();
		});
	});

	describe('renderAdd', () => {
		test('renders Add activity', () => {
			const user = { id: 'user1', host: null, uri: null } as any;
			const result = service.renderAdd(user, 'https://example.com/collection', 'https://example.com/notes/1');
			expect(result.type).toBe('Add');
		});
	});

	describe('renderRemove', () => {
		test('renders Remove activity', () => {
			const result = service.renderRemove({ id: 'user1' }, 'https://example.com/collection', 'https://example.com/notes/1');
			expect(result.type).toBe('Remove');
		});
	});

	describe('renderFlag', () => {
		test('renders Flag activity', () => {
			const user = { id: 'user1', host: null, uri: null } as any;
			const result = service.renderFlag(user, 'https://remote.example.com/users/bad', 'spam report');
			expect(result.type).toBe('Flag');
			expect(result.content).toBe('spam report');
		});
	});

	describe('renderOrderedCollection', () => {
		test('renders OrderedCollection', () => {
			const result = service.renderOrderedCollection('https://example.com/collection', 5);
			expect(result.type).toBe('OrderedCollection');
			expect(result.totalItems).toBe(5);
		});

		test('with ordered items', () => {
			const items = [{ type: 'Note', id: 'n1' }] as any[];
			const result = service.renderOrderedCollection(null, 1, undefined, undefined, items);
			expect(result.orderedItems).toEqual(items);
		});
	});

	describe('renderOrderedCollectionPage', () => {
		test('renders OrderedCollectionPage', () => {
			const result = service.renderOrderedCollectionPage(
				'https://example.com/collection?page=1',
				10,
				[{ type: 'Note' }],
				'https://example.com/collection',
			);
			expect(result.type).toBe('OrderedCollectionPage');
			expect(result.partOf).toBe('https://example.com/collection');
		});
	});

	describe('renderDocument', () => {
		test('renders Document for drive file', () => {
			const file = {
				id: 'file1',
				type: 'image/png',
				uri: null,
				url: 'https://example.com/files/file1.png',
				name: 'test.png',
				isSensitive: false,
				comment: 'A test image',
			} as any;
			const result = service.renderDocument(file);
			expect(result.type).toBe('Document');
			expect(result.mediaType).toBe('image/png');
		});
	});

	describe('renderMention', () => {
		test('renders mention for local user', () => {
			const user = { id: 'user1', host: null, username: 'alice', uri: null } as any;
			const result = service.renderMention(user);
			expect(result.type).toBe('Mention');
		});

		test('renders mention for remote user', () => {
			const user = { id: 'user2', host: 'remote.example.com', username: 'bob', uri: 'https://remote.example.com/users/bob' } as any;
			const result = service.renderMention(user);
			expect(result.type).toBe('Mention');
			expect(result.href).toBe('https://remote.example.com/users/bob');
		});
	});

	describe('renderEmoji', () => {
		test('renders Emoji', () => {
			const emoji = {
				name: 'test_emoji',
				host: null,
				publicUrl: 'https://example.com/emoji/test.png',
				originalUrl: 'https://example.com/emoji/test.png',
				type: 'image/png',
				updatedAt: new Date(),
			} as any;
			const result = service.renderEmoji(emoji);
			expect(result.type).toBe('Emoji');
			expect(result.name).toBe(':test_emoji:');
		});
	});
});
