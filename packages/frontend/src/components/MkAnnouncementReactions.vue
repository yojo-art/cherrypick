<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component
	:is="prefer.s.animation ? TransitionGroup : 'div'"
	:enterActiveClass="$style.transition_x_enterActive"
	:leaveActiveClass="$style.transition_x_leaveActive"
	:enterFromClass="$style.transition_x_enterFrom"
	:leaveToClass="$style.transition_x_leaveTo"
	:moveClass="$style.transition_x_move"
	tag="div" :class="$style.root"
>
	<MkAnnouncementReaction
		v-for="[reaction, count] in sortedReactions"
		:key="reaction"
		:announcementId="announcementId"
		:reaction="reaction"
		:count="count"
		:isInitial="initialReactions.has(reaction)"
		:myReactions="myReactions"
		@announcementReactionToggled="onAnnouncementReactionToggled"
		@showUsers="showReactedUsers"
	/>
	<button
		v-if="canAddReaction"
		key="add-reaction"
		ref="pickerButtonEl"
		v-tooltip="i18n.ts.reaction"
		class="_button"
		:class="[$style.add, { [$style.small]: prefer.s.reactionsDisplaySize === 'small', [$style.large]: prefer.s.reactionsDisplaySize === 'large' }]"
		:aria-label="i18n.ts.reaction"
		@click="pick"
	>
		<i class="ti ti-plus"></i>
	</button>
	<slot v-if="hasReactions" name="more">
		<button
			key="more"
			class="_button"
			:class="[$style.more, { [$style.small]: prefer.s.reactionsDisplaySize === 'small', [$style.large]: prefer.s.reactionsDisplaySize === 'large' }]"
			@click="showReactedUsers()"
		>
			{{ i18n.ts.more }}
		</button>
	</slot>
</component>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { TransitionGroup } from 'vue';
import * as Misskey from 'misskey-js';
import MkAnnouncementReaction from '@/components/MkAnnouncementReaction.vue';
import MkAnnouncementReactedUsersDialog from '@/components/MkAnnouncementReactedUsersDialog.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { reactionPicker } from '@/utility/reaction-picker.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import * as sound from '@/utility/sound.js';
import { useStream } from '@/stream.js';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	announcementId: Misskey.entities.Announcement['id'];
	reactions: Record<string, number>;
	myReactions: string[];
}>();

const emit = defineEmits<{
	(ev: 'update', reactions: Record<string, number>, myReactions: string[]): void;
}>();

// packages/backend/src/server/api/endpoints/announcements/reactions/create.ts の TOO_MANY_REACTIONS と同期すべし
const TOO_MANY_REACTIONS_ERROR_ID = 'd1a4b6c8-2e9f-4a3d-b7c5-6f0e8a9b2c1d';

const pickerButtonEl = useTemplateRef('pickerButtonEl');

const canToggle = computed(() => $i != null);

const reactionLimit = computed(() => $i?.policies.reactionLimit ?? 0);

const canAddReaction = computed(() => canToggle.value && myReactions.value.length < reactionLimit.value);

const reactions = ref<Record<string, number>>({ ...props.reactions });
const myReactions = ref<string[]>([...props.myReactions]);
const toggling = ref(false);

const stream = useStream();
const mainChannel = $i != null ? stream.useChannel('main') : null;

const initialReactions = new Set(Object.keys(props.reactions));

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
 * 子 MkReaction からの楽観的更新を受け取る
 */
function onAnnouncementReactionToggled(reaction: string, delta: number) {
	applyLocally(reaction, delta);
}

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

/**
 * ピッカーが返す生の絵文字文字列をバックエンドの decodeReaction と同じルールで変換する。
 * - カスタム絵文字: :name: → :name@.: (APIレスポンスがこの形式で返ってくる)
 * - Unicode絵文字: 異体字セレクタ(U+FE0F)除去(ZWJ 合字はそのまま)
 */
function normalizePickedReaction(reaction: string): string {
	const customMatch = reaction.match(/^:([\w+-]+):$/);
	if (customMatch) return `:${customMatch[1]}@.:`;
	return reaction.match('\u200d') ? reaction : reaction.replace(/\ufe0f/g, '');
}

function pick() {
	if (!canAddReaction.value || toggling.value) return;

	reactionPicker.show(pickerButtonEl.value ?? null, null, async (reaction) => {
		const normalized = normalizePickedReaction(reaction);
		if (myReactions.value.includes(normalized)) return;

		const previousReactions = { ...reactions.value };
		const previousMyReactions = [...myReactions.value];

		toggling.value = true;
		applyLocally(normalized, 1);

		try {
			await misskeyApi('announcements/reactions/create', {
				announcementId: props.announcementId,
				reaction: normalized,
			});
			sound.playMisskeySfx('reaction');
		} catch (err) {
			updateReactions(previousReactions, previousMyReactions);
			os.alert({
				type: 'error',
				text: (err as { id?: string }).id === TOO_MANY_REACTIONS_ERROR_ID
					? i18n.tsx._announcement.reactionLimitExceeded({ n: reactionLimit.value })
					: i18n.ts.somethingHappened,
			});
		} finally {
			toggling.value = false;
		}
	});
}
</script>

<style lang="scss" module>
.transition_x_move,
.transition_x_enterActive,
.transition_x_leaveActive {
	transition: opacity 0.2s cubic-bezier(0,.5,.5,1), transform 0.2s cubic-bezier(0,.5,.5,1) !important;
}
.transition_x_enterFrom,
.transition_x_leaveTo {
	opacity: 0;
	transform: scale(0.7);
}
.transition_x_leaveActive {
	position: absolute;
}

.root {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;

	&:empty {
		display: none;
	}
}

.add {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 38px;
	padding: 0 12px;
	font-size: 1.35em;
	border-radius: 999px;
	background: var(--MI_THEME-buttonBg);
	color: var(--MI_THEME-fgTransparentWeak);

	&:hover {
		background: var(--MI_THEME-buttonHoverBg, rgba(0, 0, 0, 0.1));
	}

	&.small {
		height: 30px;
		padding: 0 10px;
		font-size: 1em;
	}

	&.large {
		height: 46px;
		padding: 4px 16px;
		font-size: 1.8em;
	}
}

.more {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 38px;
	padding: 0 12px;
	font-size: 0.9em;
	border-radius: 999px;
	background: var(--MI_THEME-buttonBg);
	color: var(--MI_THEME-fgTransparentWeak);

	&:hover {
		background: var(--MI_THEME-buttonHoverBg, rgba(0, 0, 0, 0.1));
		color: var(--MI_THEME-fg);
	}

	&.small {
		height: 30px;
		padding: 0 10px;
		font-size: 0.8em;
	}

	&.large {
		height: 46px;
		padding: 4px 16px;
		font-size: 1em;
	}
}
</style>
