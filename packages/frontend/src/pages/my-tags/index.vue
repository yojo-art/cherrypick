<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :contentMax="700" :class="$style.main">
		<div class="_gaps_s">
			<div v-for="tag in tags" :key="tag" class="_panel" :class="$style.list">
				<div :class="$style.tagItem">
					<MkA :class="$style.tagItemBody" :to="`/tags/${tag}`">
						<p :title="tag">{{ tag }}</p>
					</MkA>
					<button class="_button" :class="$style.remove" @click="removeTag(tag, $event)"><i class="ti ti-x"></i></button>
				</div>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { i18n } from '@/i18n.js';

const tags = ref<string[]>([]);

const tab = ref('my');

watch(tab, async () => {
	tags.value = await misskeyApi('i/registry/get', {
		scope: ['client', 'base'],
		key: 'hashTag',
	}) as string[];
});

async function removeTag(item, ev) {
	os.popupMenu([{
		text: i18n.ts.remove,
		icon: 'ti ti-x',
		danger: true,
		action: async () => {
			tags.value = tags.value.filter(x => item !== x);
			await misskeyApi('i/registry/set', {
				scope: ['client', 'base'],
				key: 'hashTag',
				value: tags.value,
			});
		},
	}], ev.currentTarget ?? ev.target);
}

//watch(() => props.listId, fetchList, { immediate: true });

const headerActions = computed(() => [{
	icon: 'ti ti-plus',
	text: i18n.ts.create,
	handler: addTag,
}]);
const invalidChars = [' ', '　', '#', ':', '\'', '"', '!'];

function addTag () {
	os.inputText({
		title: i18n.ts.enterTagName,
	}).then(({ canceled, result: temp }) => {
		if (canceled) return;
		const input = temp as string;
		if (input === '' || invalidChars.includes(input) || tags.value.includes(input)) {
			os.alert(
				{
					type: 'error',
					title: i18n.ts.invalidTagName,
				},
			);
			return;
		}
		tags.value.push(input);
		const promise = misskeyApi('i/registry/set', {
			scope: ['client', 'base'],
			key: 'hashTag',
			value: tags.value,
		});
		os.promiseDialog(promise, null, null);
	});
}

const headerTabs = computed(() => []);

definePageMetadata(() => ({
	title: i18n.ts.tags,
	icon: 'ti ti-hash',
}));
</script>

<style lang="scss" module>
.main {
	min-height: calc(100cqh - (var(--stickyTop, 0px) + var(--stickyBottom, 0px)));
}

.list {
	display: block;
	padding: 4px;
	border: solid 1px var(--divider);
	border-radius: 6px;
	margin-bottom: 8px;

	&:hover {
		border: solid 1px var(--accent);
		text-decoration: none;
	}
}

.tagItem {
	display: flex;
}

.tagItemBody {
	flex: 1;
	min-width: 0;
	margin-right: 8px;

	&:hover {
		text-decoration: none;
	}
}

.remove {
	width: 38px;
	height: 38px;
	align-self: center;
}

.menu {
	width: 32px;
	height: 32px;
	align-self: center;
}

.more {
	margin-left: auto;
	margin-right: auto;
}

.footer {
	-webkit-backdrop-filter: var(--blur, blur(15px));
	backdrop-filter: var(--blur, blur(15px));
	border-top: solid 0.5px var(--divider);
}
</style>
