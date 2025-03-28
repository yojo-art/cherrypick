<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><MkPageHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs"/></template>

	<MkHorizontalSwipe v-model:tab="tab" :tabs="headerTabs">
		<MkSpacer v-if="tab === 'note'" key="note" :contentMax="800">
			<div v-if="notesSearchAvailable || ignoreNotesSearchAvailable">
				<XNote v-bind="props"/>
			</div>
			<div v-else>
				<MkInfo warn>{{ i18n.ts.notesSearchNotAvailable }}</MkInfo>
			</div>
		</MkSpacer>

		<MkSpacer v-if="tab === 'anote'" key="anote" :contentMax="800">
			<div v-if="advanccedNotesSearchAvailable">
				<XAnote v-bind="props"/>
			</div>
			<div v-else>
				<MkInfo warn>{{ i18n.ts.notesAdvancedSearchNotAvailable }}</MkInfo>
			</div>
		</MkSpacer>

		<MkSpacer v-else-if="tab === 'user'" key="user" :contentMax="800">
			<XUser v-bind="props"/>
		</MkSpacer>

		<MkSpacer v-else-if="tab === 'event'" key="event" :contentMax="800">
			<XEvent/>
		</MkSpacer>
	</MkHorizontalSwipe>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref, toRef } from 'vue';
import { i18n } from '@/i18n.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { notesSearchAvailable, advanccedNotesSearchAvailable } from '@/scripts/check-permissions.js';
import MkInfo from '@/components/MkInfo.vue';
import MkHorizontalSwipe from '@/components/MkHorizontalSwipe.vue';

const props = withDefaults(defineProps<{
	query?: string,
	userId?: string,
	username?: string,
	host?: string | null,
	fileAttach?: string;
	fileSensitive?: string;
	reactions?: string;
	reactionsExclude?: string;
	following?: string;
	excludeReply?: boolean;
	excludeCw?: boolean;
	excludeQuote?: boolean;
	strictSearch?: boolean;
	type?: 'note' | 'user' | 'anote' | 'event',
	origin?: 'combined' | 'local' | 'remote',
	// For storybook only
	ignoreNotesSearchAvailable?: boolean,
}>(), {
	query: '',
	userId: undefined,
	username: undefined,
	host: undefined,
	fileAttach: 'combined',
	fileSensitive: 'combined',
	reactions: '',
	reactionsExclude: '',
	following: 'combined',
	excludeReply: false,
	excludeCw: false,
	excludeQuote: false,
	strictSearch: false,
	type: 'note',
	origin: 'combined',
	ignoreNotesSearchAvailable: false,
});

const XNote = defineAsyncComponent(() => import('./search.note.vue'));
const XAnote = defineAsyncComponent(() => import('./search.anote.vue'));
const XUser = defineAsyncComponent(() => import('./search.user.vue'));
const XEvent = defineAsyncComponent(() => import('./search.event.vue'));

const tab = ref(toRef(props, 'type').value);

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'note',
	title: i18n.ts.notes,
	icon: 'ti ti-pencil',
}, {
	key: 'anote',
	title: i18n.ts.advancedNotes,
	icon: 'ti ti-pencil-plus',
}, {
	key: 'user',
	title: i18n.ts.users,
	icon: 'ti ti-users',
}, {
	key: 'event',
	title: i18n.ts.events,
	icon: 'ti ti-calendar',
}]);

definePageMetadata(() => ({
	title: i18n.ts.search,
	icon: 'ti ti-search',
}));
</script>
