/*
 * SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

function escapeRegExp(x: string): string {
	return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove only the mention addressed to the channel actor from the note text.
 */
// yojo-art: 部分一致で無関係な文字列を壊さないよう、メンションの境界を厳密に判定して除去する
export function removeChannelMention(text: string, username: string, host: string | null): string {
	const u = escapeRegExp(username);
	if (host) {
		// @username@host 形式。直前は行頭/非username文字、直後にhost継続文字が来ないこと
		const h = escapeRegExp(host);
		return text.replace(new RegExp(`(^|[^a-zA-Z0-9_])@${u}@${h}(?![a-zA-Z0-9_.-])`, 'gi'), '$1');
	} else {
		// @username 形式(ローカル)。直後がusername継続文字でも@(=別ホスト宛)でもないこと
		return text.replace(new RegExp(`(^|[^a-zA-Z0-9_])@${u}(?![a-zA-Z0-9_@])`, 'gi'), '$1');
	}
}
