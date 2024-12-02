<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :contentMax="800">
		<MkNotes ref="notes" class="" :pagination="pagination"/>
	</MkSpacer>
	<template v-if="$i" #footer>
		<div :class="$style.footer">
			<MkSpacer :contentMax="800" :marginMin="16" :marginMax="16">
				<MkButton rounded primary :class="$style.button" @click="post()"><i class="ti ti-pencil"></i>{{ i18n.ts.postToHashtag }}</MkButton>
			</MkSpacer>
		</div>
	</template>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkNotes from '@/components/MkNotes.vue';
import MkButton from '@/components/MkButton.vue';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/account.js';
import { defaultStore } from '@/store.js';
import { useStream } from '@/stream.js';
import * as os from '@/os.js';
import { genEmbedCode } from '@/scripts/get-embed-code.js';
import { misskeyApi } from '@/scripts/misskey-api';

const props = defineProps<{
	tag: string;
}>();

const pagination = {
	endpoint: 'notes/search-by-tag' as const,
	limit: 10,
	params: computed(() => ({
		tag: props.tag,
	})),
};
const notes = ref<InstanceType<typeof MkNotes>>();

const stream = useStream();

async function post() {
	defaultStore.set('postFormHashtags', props.tag);
	defaultStore.set('postFormWithHashtags', true);
	await os.post();
	defaultStore.set('postFormHashtags', '');
	defaultStore.set('postFormWithHashtags', false);
//	notes.value?.pagingComponent?.reload();
}

let tags = await misskeyApi('i/registry/get', {
	scope: ['client', 'base'],
	key: 'hashTag',
}) as string[];
const invalidChars = [' ', '　', '#', ':', '\'', '"', '!'];

const headerActions = computed(() => {
	//お気に入り登録状態はページ表示時に基づく
	let is_my_tag = tags.includes(props.tag);
	return [{
		icon: is_my_tag ? 'ti ti-heart-off' : 'ti ti-heart',
		label: i18n.ts.more,
		handler: async () => {
			//最新の情報から更新しないと他タブで弄った時に不整合を起こす
			tags = await misskeyApi('i/registry/get', {
				scope: ['client', 'base'],
				key: 'hashTag',
			}) as string[];
			//表示されたボタンの状態を元に登録/解除する
			//実際の状態を問わない
			if (is_my_tag) {
				tags = tags.filter(x => props.tag !== x);
			} else {
				const input = props.tag;
				if (input === '' || invalidChars.includes(input)) {
					os.alert(
						{
							type: 'error',
							title: i18n.ts.invalidTagName,
						},
					);
					return;
				}
				if (tags.includes(input)) {
					//既に登録済なら無視
				} else {
					tags.push(input);
				}
			}
			is_my_tag = tags.includes(props.tag);
			//アイコンを現状に合わせて変更
			headerActions.value[0].icon = is_my_tag ? 'ti ti-heart-off' : 'ti ti-heart';
			await misskeyApi('i/registry/set', {
				scope: ['client', 'base'],
				key: 'hashTag',
				value: tags,
			});
		},
	}, {
		icon: 'ti ti-dots',
		label: i18n.ts.more,
		handler: (ev: MouseEvent) => {
			os.popupMenu([{
				text: i18n.ts.genEmbedCode,
				icon: 'ti ti-code',
				action: () => {
					genEmbedCode('tags', props.tag);
				},
			}], ev.currentTarget ?? ev.target);
		},
	}];
});

const headerTabs = computed(() => []);
let connection: Misskey.ChannelConnection | null = null;

definePageMetadata(() => ({
	title: props.tag,
	icon: 'ti ti-hash',
}));
onUnmounted(() => {
	connection?.dispose();
});

function openStream() {
	connection = stream.useChannel('hashtag', {
		q: [[props.tag]],
	});
	connection.on('note', note => {
		notes.value?.pagingComponent?.prepend(note);
	});
}

openStream();
</script>

<style lang="scss" module>
.footer {
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	background: var(--MI_THEME-acrylicBg);
	border-top: solid 0.5px var(--MI_THEME-divider);
	display: flex;
}

.button {
	margin: 0 auto;
}
</style>
