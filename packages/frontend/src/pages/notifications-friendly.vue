<!--
SPDX-FileCopyrightText: syuilo and misskey-project & noridev and cherrypick-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><NotificationPageHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs" :title="i18n.ts.notifications" :icon="'ti ti-bell'"/></template>
	<MkSpacer :contentMax="800">
		<MkHorizontalSwipe v-model:tab="tab" :tabs="headerTabs">
			<div v-if="tab === 'all'" key="all">
				<XNotifications :class="$style.notifications" :excludeTypes="excludeTypes"/>
			</div>
			<div v-else-if="tab === 'newNote'" key="newNote">
				<XNotifications :class="$style.notifications" :excludeTypes="newNoteExcludeTypes" :notUseGrouped="true"/>
			</div>
			<div v-else-if="tab === 'mentions'" key="mention">
				<MkNotes :pagination="mentionsPagination" :notification="true"/>
			</div>
			<div v-else-if="tab === 'directNotes'" key="directNotes">
				<MkNotes :pagination="directNotesPagination" :notification="true"/>
			</div>
		</MkHorizontalSwipe>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { notificationTypes } from '@@/js/const.js';
import XNotifications from '@/components/MkNotifications.vue';
import MkNotes from '@/components/MkNotes.vue';
import MkHorizontalSwipe from '@/components/MkHorizontalSwipe.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { deviceKind } from '@/scripts/device-kind.js';
import { globalEvents } from '@/events.js';
import NotificationPageHeader from '@/components/global/NotificationPageHeader.vue';
import { flushNotification } from '@/scripts/check-nortification-delete.js';

const tab = ref('all');
const includeTypes = ref<string[] | null>(null);
const excludeTypes = computed(() => includeTypes.value ? notificationTypes.filter(t => !includeTypes.value.includes(t)) : undefined);
const newNoteExcludeTypes = computed(() => notificationTypes.filter(t => !['note'].includes(t)));

const props = defineProps<{
	disableRefreshButton?: boolean;
}>();

const mentionsPagination = {
	endpoint: 'notes/mentions' as const,
	limit: 10,
};

const directNotesPagination = {
	endpoint: 'notes/mentions' as const,
	limit: 10,
	params: {
		visibility: 'specified',
	},
};

function setFilter(ev) {
	const typeItems = notificationTypes.map(t => ({
		text: i18n.ts._notification._types[t],
		active: (includeTypes.value && includeTypes.value.includes(t)) ?? false,
		action: () => {
			includeTypes.value = [t];
		},
	}));
	const items = includeTypes.value != null ? [{
		icon: 'ti ti-x',
		text: i18n.ts.clear,
		action: () => {
			includeTypes.value = null;
		},
	}, { type: 'divider' as const }, ...typeItems] : typeItems;
	os.popupMenu(items, ev.currentTarget ?? ev.target);
}

const headerActions = computed(() => [deviceKind === 'desktop' && !props.disableRefreshButton ? {
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	handler: (ev: Event) => {
		globalEvents.emit('reloadNotification');
	},
} : undefined, tab.value === 'all' ? {
	text: i18n.ts.filter,
	icon: 'ti ti-filter',
	highlighted: includeTypes.value != null,
	handler: setFilter,
} : undefined, tab.value === 'all' ? {
	text: i18n.ts.markAllAsRead,
	icon: 'ti ti-check',
	handler: () => {
		os.apiWithDialog('notifications/mark-all-as-read');
	},
} : undefined, tab.value === 'all' ? {
	text: i18n.ts.notificationFlush,
	icon: 'ti ti-trash',
	handler: () => {
		flushNotification();
	}
} : undefined].filter(x => x !== undefined));

const headerTabs = computed(() => [{
	key: 'all',
	title: i18n.ts.all,
	icon: 'ti ti-point',
}, {
	key: 'newNote',
	title: i18n.ts.newNotes,
	icon: 'ti ti-pencil',
}, {
	key: 'mentions',
	title: i18n.ts.mentions,
	icon: 'ti ti-at',
}, {
	key: 'directNotes',
	title: i18n.ts.directNotes,
	icon: 'ti ti-mail',
}]);
</script>

<style lang="scss" module>
.notifications {
	border-radius: var(--MI-radius);
	overflow: clip;
}
</style>
