/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import type { UnicodeEmojiDef } from '@@/js/emojilist.js';

type ReactionAcceptanceTarget = {
	reactionAcceptance: Misskey.entities.Note['reactionAcceptance'] | Misskey.entities.Announcement['reactionAcceptance'];
	user?: Pick<Misskey.entities.Note, 'user'>['user'] | null;
};

export function checkReactionPermissions(me: Misskey.entities.MeDetailed, target: ReactionAcceptanceTarget, emoji: Misskey.entities.EmojiSimple | UnicodeEmojiDef | string): boolean {
	if (typeof emoji === 'string') return true; // UnicodeEmojiDefにも無い絵文字であれば文字列で来る。Unicode絵文字であることには変わりないので常にリアクション可能とする;
	if ('char' in emoji) return true; // UnicodeEmojiDefなら常にリアクション可能

	const roleIdsThatCanBeUsedThisEmojiAsReaction = emoji.roleIdsThatCanBeUsedThisEmojiAsReaction ?? [];
	return !(emoji.localOnly && target.user != null && target.user.host !== me.host)
      && !(emoji.isSensitive && (target.reactionAcceptance === 'nonSensitiveOnly' || target.reactionAcceptance === 'nonSensitiveOnlyForLocalLikeOnlyForRemote'))
      && (roleIdsThatCanBeUsedThisEmojiAsReaction.length === 0 || me.roles.some(role => roleIdsThatCanBeUsedThisEmojiAsReaction.includes(role.id)));
}
