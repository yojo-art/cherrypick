<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<button
	ref="buttonEl"
	v-ripple="canToggle"
	class="_button"
	:class="[$style.root, { [$style.reacted]: isReacted, [$style.canToggle]: (canToggle || alternative), [$style.small]: prefer.s.reactionsDisplaySize === 'small', [$style.large]: prefer.s.reactionsDisplaySize === 'large' }]"
	@click.stop="(ev) => toggleReaction(ev)"
>
	<MkReactionIcon style="pointer-events: none;" :class="prefer.s.limitWidthOfReaction ? $style.limitWidth : ''" :reaction="reaction" @click.stop="(ev: PointerEvent) => { toggleReaction(ev); }"/>
	<span :class="$style.count">{{ count }}</span>
</button>
</template>

<script lang="ts" setup>
import { computed, onMounted, useTemplateRef, watch, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { getUnicodeEmojiOrNull } from '@@/js/emojilist.js';
import type { ComputedRef } from 'vue';
import XDetails from '@/components/MkReactionsViewer.details.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import * as os from '@/os.js';
import { misskeyApi, misskeyApiGet } from '@/utility/misskey-api.js';
import { useTooltip } from '@/composables/use-tooltip.js';
import { $i } from '@/i.js';
import MkReactionEffect from '@/components/MkReactionEffect.vue';
import { i18n } from '@/i18n.js';
import * as sound from '@/utility/sound.js';
import { customEmojis, customEmojisMap } from '@/custom-emojis.js';
import { prefer } from '@/preferences.js';
import { haptic } from '@/utility/haptic.js';
import { useRouter } from '@/router.js';

const props = defineProps<{
	announcementId: Misskey.entities.Announcement['id'];
	reaction: string;
	count: number;
	isInitial: boolean;
	myReactions: string[];
	reactions: Record<string, number>;
}>();

const emit = defineEmits<{
	(ev: 'announcementReactionToggled', reaction: string, delta: number): void;
}>();

const buttonEl = useTemplateRef('buttonEl');

const TOO_MANY_REACTIONS_ERROR_ID = 'd1a4b6c8-2e9f-4a3d-b7c5-6f0e8a9b2c1d';

const emojiName = computed(() => props.reaction.replace(/:/g, '').replace(/@\./, ''));

const isReacted = computed(() => props.myReactions.includes(props.reaction));

const canToggle = computed(() => {
	const emoji = customEmojisMap.get(emojiName.value) ?? getUnicodeEmojiOrNull(props.reaction);
	return props.reaction.match(/@\w/) == null && $i != null && emoji != null;
});
const canGetInfo = computed(() => props.reaction.startsWith(':'));
const isLocalCustomEmoji = props.reaction[0] === ':' && props.reaction.includes('@.');

const reactionName = computed(() => {
	const r = props.reaction.replace(':', '');
	return r.slice(0, r.indexOf('@'));
});

const reactionHost = computed(() => {
	const r = props.reaction.replaceAll(':', '');
	return r.split('@')[1];
});

const router = useRouter();

const alternative: ComputedRef<string | null> = computed(() => prefer.s.reactableRemoteReactionEnabled ? (customEmojis.value.find(it => it.name === reactionName.value)?.name ?? null) : null);

const canImport = computed(() =>
	$i != null &&
	($i.isAdmin || $i.policies.canManageCustomEmojis) &&
	props.reaction.startsWith(':') &&
	!!reactionHost.value &&
	reactionHost.value !== '.' &&
	!customEmojisMap.has(reactionName.value),
);

const reactionLabel = computed(() => props.reaction.startsWith(':') ? `:${reactionName.value}:` : props.reaction);

const toggling = ref(false);

async function toggleReaction(ev: MouseEvent) {
	haptic();

	if (!canToggle.value) {
		await chooseAlternative(ev as PointerEvent);
		return;
	}
	if ($i == null) return;

	await toggleAnnouncementReaction(ev);
}

async function toggleAnnouncementReaction(_ev?: MouseEvent) {
	if (toggling.value) return;
	const isReactedNow = isReacted.value;

	if (isReactedNow) {
		const confirm = await os.confirm({
			type: 'warning',
			text: i18n.ts.cancelReactionConfirm,
		});
		if (confirm.canceled) return;
	}

	toggling.value = true;

	const delta = isReactedNow ? -1 : 1;
	emit('announcementReactionToggled', props.reaction, delta);

	try {
		if (isReactedNow) {
			await misskeyApi('announcements/reactions/delete', {
				announcementId: props.announcementId,
				reaction: props.reaction,
			});
		} else {
			await misskeyApi('announcements/reactions/create', {
				announcementId: props.announcementId,
				reaction: props.reaction,
			});
			sound.playMisskeySfx('reaction');
			// effect は watch(count)→anime() に一任 (二重表示防止)
		}
	} catch (err) {
		emit('announcementReactionToggled', props.reaction, -delta);
		const reactionLimit = $i?.policies.reactionLimit ?? 0;
		os.alert({
			type: 'error',
			text: (err as { id?: string }).id === TOO_MANY_REACTIONS_ERROR_ID
				? i18n.tsx._announcement.reactionLimitExceeded({ n: reactionLimit })
				: i18n.ts.somethingHappened,
		});
	} finally {
		toggling.value = false;
	}
}

function anime() {
	if (window.document.hidden || !prefer.s.animation || buttonEl.value == null) return;

	const rect = buttonEl.value.getBoundingClientRect();
	const x = rect.left + 16;
	const y = rect.top + (buttonEl.value.offsetHeight / 2);
	const { dispose } = os.popup(MkReactionEffect, { reaction: props.reaction, x, y }, {
		end: () => dispose(),
	});
}

async function chooseAlternative(ev: PointerEvent) {
	if (!alternative.value) return;

	const reaction = `:${alternative.value}:`;
	const isReactedNow = props.myReactions.includes(reaction);
	if (isReactedNow) {
		const confirm = await os.confirm({
			type: 'warning',
			text: i18n.ts.cancelReactionConfirm,
		});
		if (confirm.canceled) return;
		emit('announcementReactionToggled', reaction, -1);
		await misskeyApi('announcements/reactions/delete', {
			announcementId: props.announcementId,
			reaction,
		});
	} else {
		emit('announcementReactionToggled', reaction, 1);
		try {
			await misskeyApi('announcements/reactions/create', {
				announcementId: props.announcementId,
				reaction,
			});
			sound.playMisskeySfx('reaction');
			// effect は watch(count)→anime() に一任
		} catch (err) {
			emit('announcementReactionToggled', reaction, -1);
			const reactionLimit = $i?.policies.reactionLimit ?? 0;
			os.alert({
				type: 'error',
				text: (err as { id?: string }).id === TOO_MANY_REACTIONS_ERROR_ID
					? i18n.tsx._announcement.reactionLimitExceeded({ n: reactionLimit })
					: i18n.ts.somethingHappened,
			});
		}
	}
}

watch(() => props.count, (newCount, oldCount) => {
	if (oldCount < newCount) anime();
});

onMounted(() => {
	if (!props.isInitial) anime();
});

useTooltip(buttonEl, async (showing) => {
	if (buttonEl.value == null) return;

	const reactions = await misskeyApiGet('announcements/reactions', {
		announcementId: props.announcementId,
		type: props.reaction,
		limit: 10,
		_cacheKey_: props.count,
	});
	const users = reactions.map(x => x.user);
	const { dispose } = os.popup(XDetails, {
		showing,
		reaction: props.reaction,
		users,
		count: props.count,
		anchorElement: buttonEl.value,
	}, {
		closed: () => dispose(),
	});
}, 100);
</script>

<style lang="scss" module>
.root {
	display: inline-flex;
	height: 38px;
	padding: 0 12px;
	font-size: 1.35em;
	border-radius: 999px;
	align-items: center;
	justify-content: center;

	&.canToggle {
		background: var(--MI_THEME-buttonBg);

		&:hover {
			background: var(--MI_THEME-buttonHoverBg, rgba(0, 0, 0, 0.1));
		}
	}

	&:not(.canToggle) {
		cursor: default;
	}

	&.small {
		height: 30px;
		font-size: 1em;

		> .count {
			font-size: 0.9em;
			line-height: 22px;
		}
	}

	&.large {
		height: 46px;
		font-size: 1.8em;
		padding: 4px 16px;

		> .count {
			font-size: 0.6em;
			line-height: 50px;
			margin: 0 0 0 8px;
		}
	}

	&.reacted, &.reacted:hover {
		background: var(--MI_THEME-accentedBg);
		color: var(--MI_THEME-accent);
		box-shadow: 0 0 0 1px var(--MI_THEME-accent) inset;

		> .count {
			color: var(--MI_THEME-accent);
		}

		> .icon {
			filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
		}
	}
}

.limitWidth {
	max-width: 70px;
	object-fit: contain;
}

.count {
	font-size: 0.9em;
	line-height: 32px;
	margin: 0 0 0 5px;
}
</style>
