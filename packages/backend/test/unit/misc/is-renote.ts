/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { isQuote, isRenote, isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import { MiNote } from '@/models/Note.js';
import type { Packed } from '@/misc/json-schema.js';

const base: MiNote = {
	id: 'some-note-id',
	replyId: null,
	reply: null,
	renoteId: null,
	renote: null,
	threadId: null,
	text: null,
	name: null,
	cw: null,
	userId: 'some-user-id',
	user: null,
	localOnly: false,
	reactionAcceptance: null,
	renoteCount: 0,
	repliesCount: 0,
	clippedCount: 0,
	pageCount: 0,
	reactions: {},
	visibility: 'public',
	uri: null,
	url: null,
	fileIds: [],
	attachedFileTypes: [],
	visibleUserIds: [],
	mentions: [],
	mentionedRemoteUsers: '',
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
	updatedAt: null,
	updatedAtHistory: null,
	hasEvent: false,
	disableRightClick: false,
	searchableBy: 'public',
	deleteAt: null,
};

describe('misc:is-renote', () => {
	test('note without renoteId should not be Renote', () => {
		expect(isRenote(base)).toBe(false);
	});

	test('note with renoteId should be Renote and not be Quote', () => {
		const note: MiNote = { ...base, renoteId: 'some-renote-id' };
		expect(isRenote(note)).toBe(true);
		expect(isQuote(note as any)).toBe(false);
	});

	test('note with renoteId and text should be Quote', () => {
		const note: MiNote = { ...base, renoteId: 'some-renote-id', text: 'some-text' };
		expect(isRenote(note)).toBe(true);
		expect(isQuote(note as any)).toBe(true);
	});

	test('note with renoteId and cw should be Quote', () => {
		const note: MiNote = { ...base, renoteId: 'some-renote-id', cw: 'some-cw' };
		expect(isRenote(note)).toBe(true);
		expect(isQuote(note as any)).toBe(true);
	});

	test('note with renoteId and replyId should be Quote', () => {
		const note: MiNote = { ...base, renoteId: 'some-renote-id', replyId: 'some-reply-id' };
		expect(isRenote(note)).toBe(true);
		expect(isQuote(note as any)).toBe(true);
	});

	test('note with renoteId and poll should be Quote', () => {
		const note: MiNote = { ...base, renoteId: 'some-renote-id', hasPoll: true };
		expect(isRenote(note)).toBe(true);
		expect(isQuote(note as any)).toBe(true);
	});

	test('note with renoteId and non-empty fileIds should be Quote', () => {
		const note: MiNote = { ...base, renoteId: 'some-renote-id', fileIds: ['some-file-id'] };
		expect(isRenote(note)).toBe(true);
		expect(isQuote(note as any)).toBe(true);
	});
});

describe('misc:is-renote-packed', () => {
	const packedBase = {
		id: 'some-note-id',
		text: null,
		cw: null,
		renoteId: null,
		replyId: null,
		poll: null,
		fileIds: [],
	} as unknown as Packed<'Note'>;

	test('note without renoteId should not be RenotePacked', () => {
		expect(isRenotePacked(packedBase)).toBe(false);
	});

	test('note with renoteId should be RenotePacked', () => {
		const note = { ...packedBase, renoteId: 'some-renote-id' } as Packed<'Note'>;
		expect(isRenotePacked(note)).toBe(true);
	});

	test('renote with text is QuotePacked', () => {
		const note = { ...packedBase, renoteId: 'r', text: 'text' } as Packed<'Note'>;
		expect(isRenotePacked(note)).toBe(true);
		expect(isQuotePacked(note as any)).toBe(true);
	});

	test('renote with cw is QuotePacked', () => {
		const note = { ...packedBase, renoteId: 'r', cw: 'cw' } as Packed<'Note'>;
		expect(isQuotePacked(note as any)).toBe(true);
	});

	test('renote with replyId is QuotePacked', () => {
		const note = { ...packedBase, renoteId: 'r', replyId: 'reply' } as Packed<'Note'>;
		expect(isQuotePacked(note as any)).toBe(true);
	});

	test('renote with poll is QuotePacked', () => {
		const note = { ...packedBase, renoteId: 'r', poll: {} } as Packed<'Note'>;
		expect(isQuotePacked(note as any)).toBe(true);
	});

	test('renote with fileIds is QuotePacked', () => {
		const note = { ...packedBase, renoteId: 'r', fileIds: ['f1'] } as Packed<'Note'>;
		expect(isQuotePacked(note as any)).toBe(true);
	});

	test('pure renote is not QuotePacked', () => {
		const note = { ...packedBase, renoteId: 'r' } as Packed<'Note'>;
		expect(isRenotePacked(note)).toBe(true);
		expect(isQuotePacked(note as any)).toBe(false);
	});
});
