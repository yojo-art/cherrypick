<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" :style="bg">
	<img v-if="faviconUrl" :class="$style.icon" :src="faviconUrl"/>
	<div :class="$style.name">{{ instance.name }}</div>
</div>
</template>

<script lang="ts" setup>
import { computed, inject } from 'vue';

import { DI } from '@/di.js';

const serverMetadata = inject(DI.serverMetadata)!;
const mediaProxy = inject(DI.mediaProxy)!;

const props = defineProps<{
	instance?: {
		faviconUrl?: string | null
		name?: string | null
		themeColor?: string | null
	}
}>();

// if no instance data is given, this is for the local instance
const instance = props.instance ?? {
	name: serverMetadata.name,
	themeColor: (document.querySelector('meta[name="theme-color-orig"]') as HTMLMetaElement).content,
};

const faviconUrl = computed(() => props.instance ? mediaProxy.getProxiedImageUrlNullable(props.instance.faviconUrl, 'preview') : mediaProxy.getProxiedImageUrlNullable(serverMetadata.iconUrl, 'preview') ?? '/favicon.ico');

const themeColor = props.instance?.themeColor ?? serverMetadata.themeColor ?? '#777777';

const bg = {
	background: `linear-gradient(90deg, ${themeColor}, ${themeColor}00)`,
};
</script>

<style lang="scss" module>
$height: 2ex;

.root {
	display: flex;
	align-items: center;
	height: $height;
	border-radius: .5rem;
	overflow: clip;
	color: #000;
	margin-top: 5px;
	padding: 1px 5px 1px 0;
	text-shadow: /* .866 ≈ sin(60deg) */
		1px 0 1px #000,
		.866px .5px 1px #000,
		.5px .866px 1px #000,
		0 1px 1px #000,
		-.5px .866px 1px #000,
		-.866px .5px 1px #000,
		-1px 0 1px #000,
		-.866px -.5px 1px #000,
		-.5px -.866px 1px #000,
		0 -1px 1px #000,
		.5px -.866px 1px #000,
		.866px -.5px 1px #000;
}

.icon {
	height: $height;
	flex-shrink: 0;
}

.name {
	margin-left: 4px;
	line-height: 1;
	font-size: 0.9em;
	font-weight: bold;
	white-space: nowrap;
	overflow: hidden;
	max-width: 300px;
	text-overflow: ellipsis;

	&::-webkit-scrollbar {
		display: none;
	}
}

@container (max-width: 500px) {
	.name {
		max-width: 100px;
	}
}
</style>
