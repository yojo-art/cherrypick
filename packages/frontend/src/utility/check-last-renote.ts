/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';

export async function confirmRenote(renoteId:string) : Promise<boolean> {
	if (prefer.s.checkMultipleRenote === false ) return false;
	const lastRenoteId = localStorage.getItem('lastRenoteId');
	if (lastRenoteId) {
		if (lastRenoteId === renoteId) {
			const { canceled } = await os.confirm({
				type: 'warning',
				title: i18n.ts._renoteConfirm.title,
				caption: i18n.ts._renoteConfirm.caption,
				okText: i18n.ts._renoteConfirm.confirm,
				cancelText: i18n.ts.thisPostMayBeAnnoyingCancel,
			});
			return canceled;
		}
	}
	localStorage.setItem('lastRenoteId', renoteId);
	return false;
}
