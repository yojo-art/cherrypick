/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function parseSearchableByFromTags(tags: string[]): 'public' | 'followersAndReacted' | 'reactedOnly' | 'private' | null {
	if (tags.includes('searchable_by_all_users')) return 'public';
	if (tags.includes('searchable_by_followers_only')) return 'followersAndReacted';
	if (tags.includes('searchable_by_reacted_users_only')) return 'followersAndReacted';
	if (tags.includes('searchable_by_nobody')) return 'private';
	return null;
}

export function parseSearchableByFromProperty (uri: string, followersUri?: string, searchableBy?: string[]): 'public' | 'followersAndReacted' | 'reactedOnly' | 'private' | null {
	if (!searchableBy) {
		return null;
	}

	if (searchableBy.includes('https://www.w3.org/ns/activitystreams#Public')) {
		return 'public';
	} else	if (followersUri && searchableBy.includes(followersUri)) {
		return 'followersAndReacted';
	} else if (searchableBy.includes(uri)) {
		return 'reactedOnly';
	} else if (searchableBy.includes('as:Limited') || searchableBy.includes('kmyblue:Limited')) {
		return 'private';
	}
	return null;
}

export function toSerchableByProperty (configUrl: string, userId: string, serchableType: 'public' | 'followersAndReacted' | 'reactedOnly' | 'private' | null) : string[] | null {
	switch (serchableType)	{
		case 'public' :
			return ['https://www.w3.org/ns/activitystreams#Public'];
		case 'followersAndReacted' :
			return [`${configUrl}/${userId}/followers`];
		case 'reactedOnly' :
			return [`${configUrl}/users/${userId}`];
		case 'private' :
			return ['as:Limited', 'kmyblue:Limited'];
		default :
			return null;
	}
}
