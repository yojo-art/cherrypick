/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { $i } from '@/i.js';
import { get, set } from '@/utility/idb-proxy.js';
import { prefer } from '@/preferences.js';

const DEVICE_STATE_KEY = 'pizzax::base';

const searchEngines = [
	'google',
	'bing',
	'yahoo',
	'baidu',
	'naver',
	'daum',
	'duckduckgo',
	'other',
] as const;

const navbarToggleKeys = [
	'showMenuButtonInNavbar',
	'showHomeButtonInNavbar',
	'showExploreButtonInNavbar',
	'showSearchButtonInNavbar',
	'showNotificationButtonInNavbar',
	'showChatButtonInNavbar',
	'showWidgetButtonInNavbar',
	'showPostButtonInNavbar',
] as const;

function isEmojis(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((x) => typeof x === 'string');
}

/**
 * 旧store (Pizzax) に保存されていた設定値を preferences に引き継ぐ。
 * 引き継いだ値は旧ストア側からも削除するので、値が残っている初回起動時にだけ適用される。
 */
export async function migrateLegacyStoreValues(): Promise<void> {
	await migrateDeviceValues();
	await migrateAccountValues();
}

async function migrateDeviceValues(): Promise<void> {
	const legacy = await get(DEVICE_STATE_KEY) as Record<string, unknown> | null;
	if (legacy == null) return;

	let migrated = false;

	const searchEngine = searchEngines.find((x) => legacy.searchEngine === x);
	if (searchEngine !== undefined) {
		prefer.commit('searchEngine', searchEngine);
		delete legacy.searchEngine;
		migrated = true;
	}
	if (typeof legacy.searchEngineUrl === 'string') {
		prefer.commit('searchEngineUrl', legacy.searchEngineUrl);
		delete legacy.searchEngineUrl;
		migrated = true;
	}
	if (typeof legacy.searchEngineUrlQuery === 'string') {
		prefer.commit('searchEngineUrlQuery', legacy.searchEngineUrlQuery);
		delete legacy.searchEngineUrlQuery;
		migrated = true;
	}
	for (const key of navbarToggleKeys) {
		if (typeof legacy[key] === 'boolean') {
			prefer.commit(key, legacy[key]);
			delete legacy[key];
			migrated = true;
		}
	}

	if (migrated) await set(DEVICE_STATE_KEY, legacy);
}

async function migrateAccountValues(): Promise<void> {
	if ($i == null) return;

	const key = `pizzax::base::cache::${$i.id}`;
	const legacy = await get(key) as Record<string, unknown> | null;
	if (legacy == null) return;

	if (isEmojis(legacy.reactions)) {
		prefer.commit('reactions', legacy.reactions);
		delete legacy.reactions;
		await set(key, legacy);
	}
}
