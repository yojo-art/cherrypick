/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { i18n } from '@/i18n.js';
export async function importEmojiMeta(emoji, host:string) {
	emoji.category = i18n.ts.emojiRemoteDetailedUnavailable;
	try {
		const json = await(await fetch('https://' + host + '/api/emoji?name=' + emoji.name)).json();
		emoji.category = '';
		const from_json = (key: string) => {
			try {
				if (json[key]) {
					emoji[key] = json[key];
				}
			} catch {
				//一部失敗したら転送せず空欄のままにしておく
			}
		};
		from_json('license');
		from_json('aliases');
		from_json('category');
		from_json('isSensitive');
	} catch (err) {
		console.log(err);
		//リモートから取得に失敗
	}
	emoji.license = (emoji.license ? emoji.license + '\n' : '') + 'import from ' + host;
	return emoji;
}
