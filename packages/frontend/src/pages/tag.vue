<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :key="headerActions" :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
		<MkNotes ref="notes" class="" :pagination="pagination"/>
	</div>
	<template v-if="$i" #footer>
		<div :class="$style.footer">
			<div class="_spacer" style="--MI_SPACER-w: 800px; --MI_SPACER-min: 16px; --MI_SPACER-max: 16px;">
				<MkButton rounded primary :class="$style.button" @click="post()"><i class="ti ti-pencil"></i>{{ i18n.ts.postToHashtag }}</MkButton>
			</div>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkNotes from '@/components/MkNotes.vue';
import MkButton from '@/components/MkButton.vue';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { store } from '@/store.js';
import { useStream } from '@/stream.js';
import * as os from '@/os.js';
import { genEmbedCode } from '@/utility/get-embed-code.js';
import { misskeyApi } from '@/utility/misskey-api';
import { MenuItem } from '@/types/menu';

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
	store.set('postFormHashtags', props.tag);
	store.set('postFormWithHashtags', true);
	await os.post();
	store.set('postFormHashtags', '');
	store.set('postFormWithHashtags', false);
//	notes.value?.pagingComponent?.reload();
}

const invalidChars = [' ', '　', '#', ':', '\'', '"', '!'];

const headerActions = computed(() => [{
	icon: 'ti ti-dots',
	label: i18n.ts.more,
	handler: async (ev: MouseEvent) => {
		const registryTags = await (misskeyApi('i/registry/get', {
			scope: ['client', 'base'],
			key: 'hashTag',
		}).catch(() => null)) as string[] | null;
		const menuList:MenuItem[] = [];
		menuList.push({
			text: i18n.ts.embed,
			icon: 'ti ti-code',
			action: () => {
				genEmbedCode('tags', props.tag);
			},
		});
		if (registryTags !== null) {
			let tags:string[] = registryTags;
			const is_my_tag = tags.includes(props.tag);
			menuList.push({
				text: is_my_tag ? i18n.ts.unfavorite : i18n.ts.favorite,
				icon: is_my_tag ? 'ti ti-heart-off' : 'ti ti-heart',
				action: async () => {
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
					await misskeyApi('i/registry/set', {
						scope: ['client', 'base'],
						key: 'hashTag',
						value: tags,
					});
				},
			});
		}
		os.popupMenu(menuList, ev.currentTarget ?? ev.target);
	},
}]);

const headerTabs = computed(() => []);
let connection: Misskey.ChannelConnection | null = null;

definePage(() => ({
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
	background: color(from var(--MI_THEME-bg) srgb r g b / 0.5);
	border-top: solid 0.5px var(--MI_THEME-divider);
	display: flex;
}

.button {
	margin: 0 auto;
}
</style>
