<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps">
			<div v-if="tab == 'remote'">
				<MkInput
					ref="queryHostEl"
					v-model="queryHost"
					type="text"
					autocapitalize="off"
					@enter="onSearchRequest"
				>
					<template #label>{{ i18n.ts.host }}</template>
					<template v-if="queryHost != null && queryHost !== ''" #suffix><button type="button" :class="$style.deleteBtn" tabindex="-1" @click="queryHost = null; queryHostEl?.focus();"><i class="ti ti-x"></i></button></template>
				</MkInput>
			</div>
			<div v-if="paginator.fetching.value" :class="$style.center">
				<MkLoading/>
			</div>
			<div v-else-if="paginator.error.value" :class="$style.center">
				<MkError @retry="paginator.init()"/>
			</div>
			<div v-else-if="paginator.items.value.length === 0" key="_empty_">
				<slot name="empty"><MkResult type="empty" :text="i18n.ts.nothing"/></slot>
			</div>
			<div v-else :class="$style.decorations">
				<div
					v-for="avatarDecoration in paginator.items.value"
					:key="avatarDecoration.id"
					v-panel
					:class="$style.decoration"
					@click="tab == 'local' ? edit(avatarDecoration) : remoteMenu(avatarDecoration, $event)"
				>
					<div :class="$style.decorationName">
						<MkCondensedLine :minScale="0.5">{{ avatarDecoration.name }}</MkCondensedLine>
					</div>
					<MkAvatar style="width: 60px; height: 60px;" :user="$i" :decorations="[{ url: avatarDecoration.url }]" forceShowDecoration/>
				</div>
			</div>

			<div
				v-if="paginator.canFetchOlder.value"
				v-appear="paginator.fetchOlder"
				:class="$style.center"
			>
				<MkButton
					v-if="!paginator.fetchingOlder.value"
					key="_more_"
					primary rounded
					@click="paginator.fetchOlder"
				>
					<div>{{ i18n.ts.loadMore }}</div>
				</MkButton>
				<MkLoading v-else :inline="true"/>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed, defineAsyncComponent, watch, markRaw, shallowRef, useTemplateRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkButton from '../components/MkButton.vue';
import { ensureSignin } from '@/i.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkRemoteAvatarDecorationEditDialog from '@/components/MkRemoteAvatarDecorationEditDialog.vue';
import { Paginator } from '@/utility/paginator.js';
import { prefer } from '@/preferences.js';
import MkInput from '@/components/MkInput.vue';

const $i = ensureSignin();

const tab = ref('local');
const avatarDecorations = ref<Misskey.entities.AdminAvatarDecorationsListResponse>([]);

const paginator = shallowRef(createPaginator(tab.value));
const queryHost = ref<string | null>(null);
const queryHostEl = useTemplateRef('queryHostEl');

async function add(ev: MouseEvent) {
	const { dispose } = await os.popupAsyncWithDialog(import('./avatar-decoration-edit-dialog.vue').then(x => x.default), {
	}, {
		done: result => {
			if (result.created) {
				avatarDecorations.value.unshift(result.created);
			}
		},
		closed: () => dispose(),
	});
}

async function edit(avatarDecoration) {
	const { dispose } = await os.popupAsyncWithDialog(import('./avatar-decoration-edit-dialog.vue').then(x => x.default), {
		avatarDecoration: avatarDecoration,
	}, {
		done: result => {
			if (result.updated) {
				const index = avatarDecorations.value.findIndex(x => x.id === avatarDecoration.id);
				avatarDecorations.value[index] = {
					...avatarDecorations.value[index],
					...result.updated,
				};
			} else if (result.deleted) {
				avatarDecorations.value = avatarDecorations.value.filter(x => x.id !== avatarDecoration.id);
			}
		},
		closed: () => dispose(),
	});
}

const remoteMenu = (remoteDecoration, ev: MouseEvent) => {
	os.popupMenu([{
		type: 'label',
		text: remoteDecoration.name,
	}, {
		text: i18n.ts.details,
		icon: 'ti ti-info-circle',
		action: () => { detailRemoteDecoration(remoteDecoration); },
	}, {
		text: i18n.ts.import,
		icon: 'ti ti-plus',
		action: () => { importDecoration(remoteDecoration); },
	}], ev.currentTarget ?? ev.target);
};

const detailRemoteDecoration = (remoteDecoration) => {
	const { dispose } = os.popup(MkRemoteAvatarDecorationEditDialog, {
		decoration: remoteDecoration,
	}, {
		done: () => {
			dispose();
		},
		closed: () => {
			dispose();
		},
	});
};

const importDecoration = (decoration) => {
	os.apiWithDialog('admin/avatar-decorations/copy', {
		decorationId: decoration.id,
	});
};

const headerActions = computed(() => [{
	asFullButton: true,
	icon: 'ti ti-plus',
	text: i18n.ts.add,
	handler: add,
}]);

const headerTabs = computed(() => [{
	key: 'local',
	title: i18n.ts.local,
}, {
	key: 'remote',
	title: i18n.ts.remote,
}]);

async function onSearchRequest() {
	paginator.value = createPaginator('remote');
	paginator.value.init();
}

function createPaginator(currentTab: string) {
	return markRaw(new Paginator(
		currentTab === 'remote' ? 'admin/avatar-decorations/list-remote' : 'admin/avatar-decorations/list',
		{
			computedParams: computed(() => ({
				...(queryHost.value != null && { host: queryHost.value }),
			})),
			useShallowRef: true,
		},
	));
}

watch(tab, (newTab) => {
	paginator.value = createPaginator(newTab);
	paginator.value.init();
}, { immediate: true });

definePage(() => ({
	title: i18n.ts.avatarDecorations,
	icon: 'ti ti-sparkles',
}));
</script>

<style lang="scss" module>
.decorations {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	grid-gap: 12px;
}

.decoration {
	cursor: pointer;
	padding: 16px 16px 28px 16px;
	border-radius: 8px;
	text-align: center;
	font-size: 90%;
	overflow: clip;
	contain: content;
}

.decorationName {
	position: relative;
	z-index: 10;
	font-weight: bold;
	margin-bottom: 20px;
}

.center {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
}

.searchArea {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 16px;
}

.deleteBtn {
	position: relative;
	z-index: 2;
	margin: 0 auto;
	border: none;
	background: none;
	color: inherit;
	font-size: 0.8em;
	cursor: pointer;
	pointer-events: auto;
	-webkit-tap-highlight-color: transparent;
}
</style>
