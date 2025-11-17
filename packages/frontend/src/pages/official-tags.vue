<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template v-if="showHeader" #header><MkPageHeader/></template>

	<MkSpacer :contentMax="500">
		<div class="_gaps">
			<MkOfficialTag v-for="tag in official_tags" :key="tag.tag" :tagString="tag.tag" :description="tag.description" :bannerUrl="tag.bannerUrl"/>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const props = withDefaults(defineProps<{
	showHeader?: boolean;
	setTitle?: boolean;
}>(), {
	showHeader: true,
	setTitle: true,
});

const official_tags = ref<Misskey.entities.OfficialTagsShowResponse>([]);
(async () => {
	official_tags.value = await misskeyApi('official-tags/show', {});
})();

if (props.setTitle) {
	definePage(() => ({
		title: i18n.ts._official_tag.title,
		icon: 'ti ti-bookmarks',
	}));
}
</script>

