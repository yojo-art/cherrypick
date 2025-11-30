<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div>
			<MkInfo>{{ i18n.ts._official_tag.adminTopInfo }}</MkInfo>
			<div v-for="tag in tags" :key="tag.id" class="_panel _gaps_m tag_entity">
				<MkFolder>
					<template #label>{{ tag.tag }}</template>
					<MkInput v-model="tag.tag" class="input">
						<template #label>{{ i18n.ts._official_tag.adminTagName }}</template>
					</MkInput>
					<MkInput v-model="tag.bannerUrl" type="url" class="input">
						<template #label>{{ i18n.ts.imageUrl }}</template>
					</MkInput>
					<MkTextarea v-model="tag.description" class="input">
						<template #label>{{ i18n.ts.description }}</template>
					</MkTextarea>
					<MkInput v-model="tag.priority" type="number" class="input">
						<template #label>{{ i18n.ts.priority }}</template>
					</MkInput>
					<MkButton class="button input" danger @click="remove(tag)">
						<i class="ti ti-trash"></i> {{ i18n.ts.remove }}
					</MkButton>
				</MkFolder>
			</div>
			<div class="buttons">
				<MkButton class="button" inline @click="refresh()">
					<i class="ti ti-reload"></i> {{ i18n.ts.reload }}
				</MkButton>
				<MkButton class="button" inline primary @click="save()">
					<i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}
				</MkButton>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkFolder from '@/components/MkFolder.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

let last_id = 0;
type OfficialTag = {
	id: number;
	tag: string;
	description: string | null;
	bannerUrl: string | null;
	priority: number,
};
const tags = ref<OfficialTag[]>([]);

function remove(tag : OfficialTag) {
	const index = tags.value.indexOf(tag);
	tags.value.splice(index, 1);
}

async function save() {
	await misskeyApi('official-tags/update', {
		body: tags.value.map(res => {
			return {
				tag: res.tag,
				description: res.description,
				bannerUrl: res.bannerUrl,
				priority: res.priority,
			};
		}),
	});
	refresh();
}

function refresh() {
	(async () => {
		const now_tags = await misskeyApi('official-tags/show');
		tags.value = now_tags.map(res => {
			last_id++;
			return {
				id: last_id,
				tag: res.tag,
				description: res.description,
				bannerUrl: res.bannerUrl,
				priority: res.priority,
			};
		});
	})();
}

refresh();

const headerActions = computed(() => [{
	asFullButton: true,
	icon: 'ti ti-plus',
	text: i18n.ts.add,
	handler: () => {
		last_id++;
		tags.value.push({
			tag: crypto.randomUUID(),
			description: null,
			bannerUrl: null,
			priority: 100,
			id: last_id,
		});
	},
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts._official_tag.navbar,
	icon: 'ti ti-bookmarks',
}));
</script>

<style lang="scss" scoped>
.tag_entity {
	padding: 4px;
	&:not(:last-child) {
		margin-bottom: var(--margin);
	}
	.input {
		margin-top: 6px;
	}
}
.button{
	margin: 8px;
	margin-left: 0;
	margin-top: 0;
}
</style>
