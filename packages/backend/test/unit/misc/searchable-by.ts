/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { parseSearchableByFromTags, parseSearchableByFromProperty, toSerchableByProperty } from '@/core/activitypub/misc/searchableBy.js';

describe('misc:searchableBy', () => {
	describe('parseSearchableByFromTags', () => {
		test('all users', () => {
			expect(parseSearchableByFromTags(['searchable_by_all_users'])).toBe('public');
		});
		test('followers only', () => {
			expect(parseSearchableByFromTags(['searchable_by_followers_only'])).toBe('followersAndReacted');
		});
		test('reacted users only', () => {
			expect(parseSearchableByFromTags(['searchable_by_reacted_users_only'])).toBe('reactedOnly');
		});
		test('nobody', () => {
			expect(parseSearchableByFromTags(['searchable_by_nobody'])).toBe('private');
		});
		test('unknown tags', () => {
			expect(parseSearchableByFromTags([])).toBeNull();
			expect(parseSearchableByFromTags(['searchable_by_someone'])).toBeNull();
		});
		test('precedence', () => {
			expect(parseSearchableByFromTags(['searchable_by_all_users', 'searchable_by_nobody'])).toBe('public');
			expect(parseSearchableByFromTags(['searchable_by_followers_only', 'searchable_by_reacted_users_only'])).toBe('followersAndReacted');
			expect(parseSearchableByFromTags(['searchable_by_reacted_users_only', 'searchable_by_nobody'])).toBe('reactedOnly');
		});
	});

	describe('parseSearchableByFromProperty', () => {
		const uri = 'https://example.com/users/1';
		const followersUri = 'https://example.com/users/1/followers';

		test('public', () => {
			expect(parseSearchableByFromProperty(uri, followersUri, ['https://www.w3.org/ns/activitystreams#Public'])).toBe('public');
		});
		test('followers', () => {
			expect(parseSearchableByFromProperty(uri, followersUri, [followersUri])).toBe('followersAndReacted');
		});
		test('reacted only', () => {
			expect(parseSearchableByFromProperty(uri, followersUri, [uri])).toBe('reactedOnly');
		});
		test('private', () => {
			expect(parseSearchableByFromProperty(uri, followersUri, ['as:Limited'])).toBe('private');
			expect(parseSearchableByFromProperty(uri, followersUri, ['kmyblue:Limited'])).toBe('private');
		});
		test('unspecified', () => {
			expect(parseSearchableByFromProperty(uri, followersUri, undefined)).toBeNull();
			expect(parseSearchableByFromProperty(uri, followersUri, [])).toBeNull();
		});
	});

	describe('toSerchableByProperty', () => {
		test('reacted only', () => {
			expect(toSerchableByProperty('https://example.com', '1', 'reactedOnly')).toEqual(['https://example.com/users/1']);
		});
		test('followers and reacted', () => {
			expect(toSerchableByProperty('https://example.com', '1', 'followersAndReacted')).toEqual(['https://example.com/1/followers']);
		});
		test('public', () => {
			expect(toSerchableByProperty('https://example.com', '1', 'public')).toEqual(['https://www.w3.org/ns/activitystreams#Public']);
		});
		test('private', () => {
			expect(toSerchableByProperty('https://example.com', '1', 'private')).toEqual(['as:Limited', 'kmyblue:Limited']);
		});
		test('null', () => {
			expect(toSerchableByProperty('https://example.com', '1', null)).toBeNull();
		});
	});
});
