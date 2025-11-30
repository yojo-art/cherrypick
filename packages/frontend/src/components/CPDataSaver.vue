<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkFolder>
	<template #label>{{ i18n.ts.dataSaver }}</template>

	<div class="_gaps_m">
		<MkInfo v-if="props.showDescription">{{ i18n.ts.reloadRequiredToApplySettings }}</MkInfo>

		<div class="_buttons">
			<MkButton inline @click="enableAllDataSaver">{{ i18n.ts.enableAll }}</MkButton>
			<MkButton inline @click="disableAllDataSaver">{{ i18n.ts.disableAll }}</MkButton>
		</div>
		<div class="_gaps_m">
			<MkSwitch v-model="dataSaver.media">
				{{ i18n.ts._dataSaver._media.title }}
				<template v-if="props.showDescription" #caption>{{ i18n.ts._dataSaver._media.description }}</template>
			</MkSwitch>
			<MkSwitch v-model="dataSaver.avatar">
				{{ i18n.ts._dataSaver._avatar.title }}
				<template v-if="props.showDescription" #caption>{{ i18n.ts._dataSaver._avatar.description }}</template>
			</MkSwitch>
			<MkSwitch v-model="dataSaver.urlPreview">
				{{ i18n.ts._dataSaver._urlPreview.title }}
				<template v-if="props.showDescription" #caption>{{ i18n.ts._dataSaver._urlPreview.description }}</template>
			</MkSwitch>
			<MkSwitch v-model="dataSaver.code">
				{{ i18n.ts._dataSaver._code.title }}
				<template v-if="props.showDescription" #caption>{{ i18n.ts._dataSaver._code.description }}</template>
			</MkSwitch>
		</div>
	</div>
</MkFolder>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInfo from '@/components/MkInfo.vue';

const props = withDefaults(defineProps<{
	showDescription?: boolean;
}>(), {
	showDescription: true,
});
const dataSaver = ref(prefer.s.dataSaver);

function enableAllDataSaver() {
	const g = { ...prefer.s.dataSaver };
	Object.keys(g).forEach((key) => { g[key] = true; });
	dataSaver.value = g;
}

function disableAllDataSaver() {
	const g = { ...prefer.s.dataSaver };
	Object.keys(g).forEach((key) => { g[key] = false; });
	dataSaver.value = g;
}

watch(dataSaver, (to) => {
	prefer.commit('dataSaver', to);
}, {
	deep: true,
});
</script>
