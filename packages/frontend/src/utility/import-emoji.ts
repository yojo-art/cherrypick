/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { defineAsyncComponent } from 'vue';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';

type EmojiData = Misskey.entities.EmojiDetailed;

export async function copyEmoji(emoji: EmojiData, showDialog = true): Promise<EmojiData | null> {
	let readText = '' as string | null;

	//条件付きか、ライセンス情報などがある場合その情報を表示する
	if (emoji.copyPermission === 'conditional' || emoji.license || emoji.usageInfo) {
		const { canceled } = await os.confirm({
			type: 'warning',
			title: i18n.ts._emoji.seeLicense,
			text: `${i18n.ts.license}: ${emoji.license}\r\n`
				+ `${i18n.ts._emoji.usageInfo}: ${emoji.usageInfo}`,
		});
		if (canceled) return null;
		readText = emoji.license;
	} else if (emoji.copyPermission === 'deny') {
		await os.alert({ type: 'warning', title: i18n.ts._emoji.copyPermissionIsDeny });
		return null;
	}

	let emojiInfo: any | null = null;

	const promise = misskeyApi('admin/emoji/copy', {
		emojiId: emoji.id,
		...(readText === '' ? {} : { licenseReadText: readText }),
	}, undefined);

	await os.promiseDialog(promise, (res) => {
		emojiInfo = res;
		if (showDialog) os.toast(i18n.ts._emoji.imported);
	}, async (err) => {
		await os.alert({ type: 'error', title: err.message, text: err.id });
	});

	if (!emojiInfo?.id) return null;
	return showDialog ? importEmojiMeta(emojiInfo, emoji.host ?? '') : emojiInfo;
}

export async function stealEmoji(emojiName: string, host: string): Promise<any | null> {
	let emoji: any | null = null;
	const steal = misskeyApi('admin/emoji/steal', { name: emojiName, host: host }, undefined);
	await os.promiseDialog(steal, (res) => {
		emoji = res;
		os.toast(i18n.ts._emoji.imported);
	}, async (err) => {
		//コピー不可
		if (err.id === '1beadfcc-3882-f3c9-ee57-ded45e4741e4') {
			await os.alert({ type: 'warning', title: i18n.ts._emoji.copyPermissionIsDeny });
			return;
		}
		//条件付きのため絵文字情報を取得して再度インポート
		if (err.id === '28d9031e-ddbc-5ba3-c435-fcb5259e8408') {
			const promise = misskeyApi('emoji', { name: emojiName, host: host }, undefined);
			const emojiInfo = await os.promiseDialog(promise, null, async (err) => {
				await os.alert({ type: 'error', title: err.message, text: err.id });
			});
			emoji = await copyEmoji(emojiInfo, false);
			if (emoji !== null) os.toast(i18n.ts._emoji.imported);
			return;
		}
		await os.alert({ type: 'error', title: err.message, text: err.id });
	});
	return emoji === null ? null : await importEmojiMeta(emoji, host);
}

export async function importEmojiMeta(emoji: EmojiData, host:string) {
	//カテゴリ・ライセンス・エイリアスのいずれかがある場合、連合で取得しているのでリモートAPIで確認しない
	if (emoji.category !== null ||
		emoji.license !== null ||
		0 < emoji.aliases.length) return emoji;
	let success = true;

	try {
		const json = await(await window.fetch('https://' + host + '/api/emoji?name=' + emoji.name)).json();
		// 一部取得失敗は握りつぶす
		try {emoji.license = json['license'] ?? emoji.license;} catch { /**/ }
		try {emoji.aliases = json['aliases'] ?? emoji.aliases;} catch { /**/ }
		try {emoji.category = json['category'] ?? emoji.category;} catch { /**/ }
		try {emoji.isSensitive = json['isSensitive'] ?? emoji.isSensitive;} catch { /**/ }
	} catch (err) {
		console.log(err);
		//リモートから取得に失敗
		success = false;
	}
	emoji.license = (emoji.license ? emoji.license + '\n' : '') + 'import from ' + host;
	os.popup(defineAsyncComponent(() => import('@/pages/emoji-edit-dialog.vue')), {
		emoji: emoji,
		showFetchResult: true,
		fetchSuccess: success,
	});
	return emoji;
}
