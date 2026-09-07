<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialogEl"
	:width="450"
	:height="500"
	:withOkButton="false"
	@close="dialogEl?.close()"
	@closed="emit('closed')"
>
	<template #header>{{ i18n.ts.reaction }}</template>

	<div :class="$style.root">
		<div :class="$style.tabs">
			<button
				v-for="[reaction, count] in sortedReactions"
				:key="reaction"
				class="_button"
				:class="[$style.tab, { [$style.tabActive]: tabType === reaction }]"
				:aria-pressed="tabType === reaction"
				@click="tabType = reaction"
			>
				<MkReactionIcon :reaction="reaction" :noStyle="true" style="width: 24px; height: 24px;"/>
				<span :class="$style.tabCount">{{ count }}</span>
			</button>
		</div>

		<MkPagination v-if="tabType != null" :key="tabType" :paginator="paginator">
			<template #default="{ items }">
				<div class="_gaps_s">
					<MkA v-for="item in items" :key="item.id" :to="userPage(item.user)">
						<MkUserCardMini :user="item.user" :withChart="false"/>
					</MkA>
				</div>
			</template>
		</MkPagination>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkUserCardMini from '@/components/MkUserCardMini.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { userPage } from '@/filters/user.js';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	announcementId: Misskey.entities.Announcement['id'];
	reactions: Record<string, number>;
	initialReaction?: string | null;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const dialogEl = useTemplateRef('dialogEl');

const sortedReactions = computed(() => Object.entries(props.reactions)
	.filter(([, count]) => count > 0)
	.sort((a, b) => b[1] - a[1]));

const tabType = ref<string | null>(props.initialReaction ?? sortedReactions.value[0]?.[0] ?? null);

const paginator = markRaw(new Paginator('announcements/reactions', {
	limit: 30,
	computedParams: computed(() => ({
		announcementId: props.announcementId,
		type: tabType.value,
	})),
}));
</script>

<style lang="scss" module>
.root {
	padding: 16px;
}

.tabs {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	padding-bottom: 16px;
	border-bottom: solid 0.5px var(--MI_THEME-divider);
	margin-bottom: 16px;
}

.tab {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 6px;

	&:hover {
		border-color: var(--MI_THEME-accent);
	}
}

.tabActive {
	border-color: var(--MI_THEME-accent);
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}

.tabCount {
	font-size: 0.9em;
}
</style>
