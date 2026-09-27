/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';

/**
 * 未解決の通報があるか. コントロールパネルとナビゲーションの「通報」の点滅に使う.
 */
export const hasUnresolvedAbuseReport = ref(false);

let fetching: Promise<void> | null = null;

export function fetchUnresolvedAbuseReport(): Promise<void> {
	if ($i == null || !($i.isAdmin || $i.isModerator)) return Promise.resolve();

	fetching ??= misskeyApi('admin/abuse-user-reports', {
		state: 'unresolved',
		limit: 1,
	}).then(reports => {
		hasUnresolvedAbuseReport.value = reports.length > 0;
	}).catch(() => {
		// best-effort: 取得できなければ直前の状態を保つ
	}).finally(() => {
		fetching = null;
	});

	return fetching;
}
