/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'cherrypick-js';
import { url } from '@@/js/config.js';
import { defaultStore } from '@/store.js';

export const acct = (user: Misskey.Acct) => {
	return Misskey.acct.toString(user);
};

export const userName = (user: Misskey.entities.User) => {
	if (!defaultStore.state.nicknameEnabled) {
		return user.name ?? user.username;
	}
	return defaultStore.reactiveState.nicknameMap.value[user.id] || user.name || user.username;
};

export const userPage = (user: Misskey.Acct, path?: string, absolute = false) => {
	return `${absolute ? url : ''}/@${acct(user)}${(path ? `/${path}` : '')}`;
};
