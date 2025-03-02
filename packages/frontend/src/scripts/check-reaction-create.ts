/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import * as sound from '@/scripts/sound.js';
import { defaultStore } from '@/store.js';
import { misskeyApi } from '@/scripts/misskey-api.js';

export async function notesReactionsCreate(data:{ noteId: string, reaction: string }, opt = { mute: false }) {
	if (defaultStore.state.checkReactionDialog === true ) {
		const { canceled } = await os.confirm({
			type: 'warning',
			title: i18n.tsx._reactionConfirm.title({ emoji: data.reaction }),
			caption: i18n.ts._reactionConfirm.caption,
			okText: i18n.ts._reactionConfirm.confirm,
			cancelText: i18n.ts.thisPostMayBeAnnoyingCancel,
		});
		if (canceled) return;
	}
	if (!opt.mute) sound.playMisskeySfx('reaction');
	await misskeyApi('notes/reactions/create', data);
}
