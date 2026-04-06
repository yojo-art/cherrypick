/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { getNoteSummary } from '@/misc/get-note-summary.js';

const base = {
	deletedAt: null,
	isHidden: false,
	cw: null,
	text: null,
	files: [],
	poll: null,
	replyId: null,
	reply: null,
	renoteId: null,
	renote: null,
} as any;

describe('misc:get-note-summary', () => {
	test('deleted note', () => {
		expect(getNoteSummary({ ...base, deletedAt: '2024-01-01' })).toBe('(\u274C\u26D4)');
	});

	test('hidden note', () => {
		expect(getNoteSummary({ ...base, isHidden: true })).toBe('(\u26D4)');
	});

	test('text only', () => {
		expect(getNoteSummary({ ...base, text: 'Hello world' })).toBe('Hello world');
	});

	test('cw hides text', () => {
		expect(getNoteSummary({ ...base, cw: 'Content Warning', text: 'Hidden text' })).toBe('Content Warning');
	});

	test('with files', () => {
		const note = { ...base, text: 'Photo', files: [{ id: '1' }, { id: '2' }] };
		expect(getNoteSummary(note)).toBe('Photo (\u{1F4CE}2)');
	});

	test('with poll', () => {
		expect(getNoteSummary({ ...base, text: 'Vote', poll: {} })).toBe('Vote (\u{1F4CA})');
	});

	test('reply with reply object', () => {
		const note = {
			...base,
			text: 'Reply text',
			replyId: 'reply1',
			reply: { ...base, text: 'Original' },
		};
		expect(getNoteSummary(note)).toBe('Reply text\n\nRE: Original');
	});

	test('reply without reply object', () => {
		const note = { ...base, text: 'Reply', replyId: 'reply1', reply: null };
		expect(getNoteSummary(note)).toBe('Reply\n\nRE: ...');
	});

	test('renote with renote object', () => {
		const note = {
			...base,
			renoteId: 'renote1',
			renote: { ...base, text: 'Original note' },
		};
		expect(getNoteSummary(note)).toBe('RN: Original note');
	});

	test('renote without renote object', () => {
		const note = { ...base, renoteId: 'renote1', renote: null };
		expect(getNoteSummary(note)).toBe('RN: ...');
	});

	test('empty note', () => {
		expect(getNoteSummary(base)).toBe('');
	});

	test('files only (no text)', () => {
		const note = { ...base, files: [{ id: '1' }] };
		expect(getNoteSummary(note)).toBe('(\u{1F4CE}1)');
	});
});
