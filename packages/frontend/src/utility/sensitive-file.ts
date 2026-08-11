/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';
import { confirmR18, wasConfirmR18 } from '@/utility/check-r18.js';
import MkRippleEffect from '@/components/MkRippleEffect.vue';

export function shouldHideFileByDefault(file: Misskey.entities.DriveFile): boolean {
	if (prefer.s.nsfw === 'force' || prefer.s.dataSaver.media) {
		return true;
	}

	if (file.isSensitive && prefer.s.nsfw !== 'ignore') {
		return true;
	}

	if (file.isSensitive && !wasConfirmR18()) {
		return true;
	}

	return false;
}

export async function canRevealFile(file: Misskey.entities.DriveFile, opts?:{ isDoubleClick?: boolean, ev?: PointerEvent }): Promise<boolean> {
	if (!file.isSensitive) return true;
	// Misskey: センシティブなメディアをクリックしたとき呼ばれる
	// yojo-art: optsはすべてyojo-art側の拡張
	if (!wasConfirmR18()) {
		// yojo-art: 初めてセンシティブなメディアを開くとき年齢確認ダイアログを表示する
		return await confirmR18();
	} else if (prefer.s.confirmWhenRevealingSensitiveMedia) {
		// Misskey: センシティブなメディアを開くときに確認する
		const { canceled } = await os.confirm({
			type: 'question',
			text: i18n.ts.sensitiveMediaRevealConfirm,
		});
		if (canceled) return false;
	} else if (prefer.s.nsfwOpenBehavior === 'doubleClick') {
		// CherryPick: ダブルタップしてセンシティブなメディアを開く
		if (opts?.isDoubleClick === true) return true;//呼び出し元がダブルクリックなら無条件許可
		//単クリックならその位置表示だけして拒否
		const { dispose } = os.popup(MkRippleEffect, { x: opts?.ev?.clientX ?? 0, y: opts?.ev?.clientY ?? 0 }, {
			end: () => dispose(),
		});
		return false;
	}

	return true;
}
