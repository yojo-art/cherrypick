<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<template v-if="isLikeOnly">
		<button
			v-ripple="canToggle"
			class="_button"
			:class="[$style.reaction, { [$style.reacted]: myReactions.includes(likeOnlyReaction), [$style.canToggle]: canToggle }]"
			:disabled="!canToggle"
			:aria-pressed="myReactions.includes(likeOnlyReaction)"
			:aria-label="likeOnlyReaction"
			@click="toggle(likeOnlyReaction)"
			@contextmenu.prevent.stop="showReactedUsers(likeOnlyReaction)"
		>
			<MkReactionIcon style="pointer-events: none;" :reaction="likeOnlyReaction"/>
			<span :class="$style.count">{{ likeOnlyCount }}</span>
		</button>
		<button
			v-if="hasReactions"
			class="_button"
			:class="[$style.reaction, $style.more]"
			@click="showReactedUsers()"
		>
			{{ i18n.ts.more }}
		</button>
	</template>
	<template v-else>
		<button
			v-for="[reaction, count] in sortedReactions"
			:key="reaction"
			v-ripple="canToggle"
			class="_button"
			:class="[$style.reaction, { [$style.reacted]: myReactions.includes(reaction), [$style.canToggle]: canToggle }]"
			:disabled="!canToggle"
			:aria-pressed="myReactions.includes(reaction)"
			:aria-label="reaction"
			@click="toggle(reaction)"
			@contextmenu.prevent.stop="showReactedUsers(reaction)"
		>
			<MkReactionIcon style="pointer-events: none;" :reaction="reaction"/>
			<span :class="$style.count">{{ count }}</span>
		</button>
		<button
			v-if="canAddReaction"
			ref="pickerButtonEl"
			v-tooltip="i18n.ts.reaction"
			class="_button"
			:class="[$style.reaction, $style.add]"
			:aria-label="i18n.ts.reaction"
			@click="pick"
		>
			<i class="ti ti-plus"></i>
		</button>
		<button
			v-if="hasReactions"
			class="_button"
			:class="[$style.reaction, $style.more]"
			@click="showReactedUsers()"
		>
			{{ i18n.ts.more }}
		</button>
	</template>
</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import * as Misskey from 'misskey-js';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkAnnouncementReactedUsersDialog from '@/components/MkAnnouncementReactedUsersDialog.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { reactionPicker } from '@/utility/reaction-picker.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import * as sound from '@/utility/sound.js';
import { useStream } from '@/stream.js';

const props = defineProps<{
	announcementId: Misskey.entities.Announcement['id'];
	reactions: Record<string, number>;
	myReactions: string[];
	reactionAcceptance?: Misskey.entities.Announcement['reactionAcceptance'];
}>();

const emit = defineEmits<{
	(ev: 'update', reactions: Record<string, number>, myReactions: string[]): void;
}>();

const pickerButtonEl = useTemplateRef('pickerButtonEl');

const canToggle = computed(() => $i != null);
const isLikeOnly = computed(() => props.reactionAcceptance === 'likeOnly');
const likeOnlyReaction = '\u2764';
const likeOnlyCount = computed(() => reactions.value[likeOnlyReaction] ?? 0);
const canAddReaction = computed(() => canToggle.value && !isLikeOnly.value);

const reactions = ref<Record<string, number>>({ ...props.reactions });
const myReactions = ref<string[]>([...props.myReactions]);
const toggling = ref(false);

const stream = useStream();
const mainChannel = $i != null ? stream.useChannel('main') : null;

watch(() => props.reactions, (newReactions) => {
	reactions.value = { ...newReactions };
});

watch(() => props.myReactions, (newMyReactions) => {
	myReactions.value = [...newMyReactions];
});

function updateReactions(nextReactions: Record<string, number>, nextMyReactions: string[]) {
	reactions.value = nextReactions;
	myReactions.value = nextMyReactions;
	emit('update', nextReactions, nextMyReactions);
}

function onReacted({ announcementId, reaction, userId }: Misskey.entities.AnnouncementReacted) {
	if (announcementId !== props.announcementId) return;
	// 自分の操作は既に楽観的に反映済みなので無視する
	if (userId === $i?.id) return;

	const nextReactions = { ...reactions.value };
	nextReactions[reaction] = (nextReactions[reaction] ?? 0) + 1;
	updateReactions(nextReactions, myReactions.value);
}

function onUnreacted({ announcementId, reaction, userId }: Misskey.entities.AnnouncementUnreacted) {
	if (announcementId !== props.announcementId) return;
	if (userId === $i?.id) return;

	const nextReactions = { ...reactions.value };
	const count = (nextReactions[reaction] ?? 0) - 1;
	if (count > 0) {
		nextReactions[reaction] = count;
	} else {
		delete nextReactions[reaction];
	}
	updateReactions(nextReactions, myReactions.value);
}

onMounted(() => {
	stream.on('announcementReacted', onReacted);
	stream.on('announcementUnreacted', onUnreacted);
	mainChannel?.on('announcementReacted', onReacted);
	mainChannel?.on('announcementUnreacted', onUnreacted);
});

onUnmounted(() => {
	stream.off('announcementReacted', onReacted);
	stream.off('announcementUnreacted', onUnreacted);
	mainChannel?.off('announcementReacted', onReacted);
	mainChannel?.off('announcementUnreacted', onUnreacted);
	mainChannel?.dispose();
});

const sortedReactions = computed(() => Object.entries(reactions.value)
	.filter(([, count]) => count > 0)
	.sort((a, b) => b[1] - a[1]));

const hasReactions = computed(() => sortedReactions.value.length > 0);

function showReactedUsers(initialReaction?: string) {
	const { dispose } = os.popup(MkAnnouncementReactedUsersDialog, {
		announcementId: props.announcementId,
		reactions: reactions.value,
		initialReaction: initialReaction ?? null,
	}, {
		closed: () => dispose(),
	});
}

/**
 * リアクションを楽観的に適用し、失敗時に巻き戻せるよう元の状態を返す。
 */
function applyLocally(reaction: string, delta: number) {
	const nextReactions = { ...reactions.value };
	const count = (nextReactions[reaction] ?? 0) + delta;

	if (count > 0) {
		nextReactions[reaction] = count;
	} else {
		delete nextReactions[reaction];
	}

	const nextMyReactions = delta > 0
		? (myReactions.value.includes(reaction) ? myReactions.value : [...myReactions.value, reaction])
		: myReactions.value.filter(r => r !== reaction);

	updateReactions(nextReactions, nextMyReactions);
}

async function toggle(reaction: string) {
	if (!canToggle.value || toggling.value) return;

	const previousReactions = { ...reactions.value };
	const previousMyReactions = [...myReactions.value];
	const isReacted = previousMyReactions.includes(reaction);

	toggling.value = true;
	applyLocally(reaction, isReacted ? -1 : 1);

	try {
		if (isReacted) {
			await misskeyApi('announcements/reactions/delete', {
				announcementId: props.announcementId,
				reaction,
			});
		} else {
			await misskeyApi('announcements/reactions/create', {
				announcementId: props.announcementId,
				reaction,
			});
			sound.playMisskeySfx('reaction');
		}
	} catch {
		updateReactions(previousReactions, previousMyReactions);
		os.alert({
			type: 'error',
			text: i18n.ts.somethingHappened,
		});
	} finally {
		toggling.value = false;
	}
}

/**
 * ピッカーが返す生の絵文字文字列をバックエンドの decodeReaction と同じルールで変換する。
 * - カスタム絵文字: :name: → :name@.: (APIレスポンスがこの形式で返ってくる)
 * - Unicode絵文字: 異体字セレクタ(U+FE0F)除去(ZWJ 合字はそのまま)
 */
function normalizePickedReaction(reaction: string): string {
	// カスタム絵文字を :name@.: 形式に変換
	const customMatch = reaction.match(/^:([\w+-]+):$/);
	if (customMatch) return `:${customMatch[1]}@.:`;
	// Unicode絵文字の異体字セレクタを除去
	return reaction.match('\u200d') ? reaction : reaction.replace(/\ufe0f/g, '');
}

function pick() {
	if (!canAddReaction.value) return;

	reactionPicker.show(pickerButtonEl.value ?? null, null, (reaction) => {
		const normalized = normalizePickedReaction(reaction);
		// すでに付けているリアクションを選んだ場合は何もしない
		if (myReactions.value.includes(normalized)) return;
		toggle(normalized);
	});
}
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}

.reaction {
	display: inline-flex;
	align-items: center;
	height: 32px;
	padding: 0 6px;
	border-radius: 4px;
	background: var(--MI_THEME-buttonBg);

	&.canToggle:hover {
		background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
	}

	&:not(.canToggle) {
		cursor: default;
	}

	&.reacted,
	&.reacted:hover {
		background: var(--MI_THEME-accentedBg);
		color: var(--MI_THEME-accent);
		box-shadow: 0 0 0 1px var(--MI_THEME-accent) inset;

		> .count {
			color: var(--MI_THEME-accent);
		}
	}
}

.count {
	font-size: 0.9em;
	line-height: 32px;
	margin: 0 0 0 4px;
}

.add {
	color: var(--MI_THEME-fgTransparentWeak);
}

.more {
	font-size: 0.9em;
	color: var(--MI_THEME-fgTransparentWeak);

	&:hover {
		color: var(--MI_THEME-fg);
	}
}
</style>
