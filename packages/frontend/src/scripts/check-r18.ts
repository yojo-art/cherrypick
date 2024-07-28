/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { miLocalStorage } from '@/local-storage.js';

export async function confirmR18() {
	if (miLocalStorage.getItem('checkR18') === 'true') {
		//確認処理を済ませてる場合
		return true;
	} else {
		const { canceled } = await os.confirm({
			type: 'warning',
			title: i18n.ts._checkR18.title,
			text: i18n.ts._checkR18.description,
			okText: i18n.ts.yes,
			cancelText: i18n.ts.no,
		});
		if (canceled) {
			//いいえ18歳未満です
			return false;
		}
		//はい18禁コンテンツの閲覧を望みます
		miLocalStorage.setItem('checkR18', 'true');
		return true;
	}
}
export function wasConfirmR18() {
	return miLocalStorage.getItem('checkR18') === 'true';
}
