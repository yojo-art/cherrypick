<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<input v-model="query" :class="$style.input" type="search" :placeholder="q" @click.stop>
	<button :class="$style.button" @click.stop="search"><i class="ti ti-search"></i> {{ i18n.ts.searchByGoogle }}</button>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { url as local } from '@@/js/config.js';
import { i18n } from '@/i18n.js';
import { defaultStore } from '@/store.js';
import { useRouter } from '@/router/supplier.js';

const router = useRouter();

const props = defineProps<{
	q: string;
}>();

const query = ref(props.q);

const search = () => {
	const sp = new URLSearchParams();
	sp.append('q', query.value);
	const searchUrl = String(defaultStore.state.searchEngine).replaceAll('%s', sp.toString());
	const url = new URL(searchUrl, local);
	if (url.origin === local) {
		router.push(url.toString().substring(local.length));
	} else {
		window.open(searchUrl, '_blank', 'noopener');
	}
};
</script>

<style lang="scss" module>
.root {
	display: flex;
	margin: 8px 0;
}

.input {
	flex-shrink: 1;
	padding: 10px;
	width: 100%;
	height: 40px;
	font-size: 16px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 4px 0 0 4px;
	-webkit-appearance: textfield;
}

.button {
	flex-shrink: 0;
	margin: 0;
	padding: 0 16px;
	border: solid 1px var(--MI_THEME-divider);
	border-left: none;
	border-radius: 0 4px 4px 0;

	&:active {
		box-shadow: 0 2px 4px rgba(#000, 0.15) inset;
	}
}
</style>
