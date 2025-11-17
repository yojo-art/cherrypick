/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';

export async function flushNotification() {
	const { canceled } = await os.confirm({
		type: 'warning',
		title: i18n.ts._deleteConfirm.notificationDeleteTitle,
		okText: i18n.ts._deleteConfirm.delete,
		cancelText: i18n.ts.cancel,
	});
	if (canceled) return;
	os.apiWithDialog('notifications/flush');
}
