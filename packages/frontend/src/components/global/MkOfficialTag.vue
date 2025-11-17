<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkA :to="`/tags/${props.tagString}`" class="tag_link _panel" tabindex="-1">
	<div class="banner" :style="bannerStyle">
		<div class="fade"></div>
		<div class="name"><i class="ti ti-hash"></i> {{ props.tagString }}</div>
	</div>
	<article v-if="props.description">
		<p :title="props.description">{{ props.description.length > 85 ? props.description.slice(0, 85) + '…' : props.description }}</p>
	</article>
</MkA>
<div></div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { i18n } from '@/i18n.js';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { $i } from '@/i.js';

const props = defineProps<{
	tagString: string;
	description: string | null;
	bannerUrl: string | null;
}>();

const bannerStyle = computed(() => {
	if (props.bannerUrl) {
		return { backgroundImage: `url(${props.bannerUrl})` };
	} else {
		return { backgroundColor: '#4c5e6d' };
	}
});
</script>

<style lang="scss" scoped>
.tag_link {
	display: block;
	overflow: hidden;
	width: 100%;

	&:hover {
		text-decoration: none;
	}

	> .banner {
		position: relative;
		width: 100%;
		aspect-ratio: 7 / 3;
		background-position: center;
		background-size: contain;
		background-repeat: no-repeat;

		> .fade {
			position: absolute;
			bottom: 0;
			left: 0;
			width: 100%;
			height: 64px;
			background: linear-gradient(0deg, var(--panel), var(--X15));
		}

		> .name {
			position: absolute;
			top: 16px;
			left: 16px;
			padding: 12px 16px;
			background: rgba(0, 0, 0, 0.7);
			color: #fff;
			font-size: 1.2em;
		}
	}

	> article {
		padding: 16px;

		> p {
			margin: 0;
			font-size: 1em;
		}
	}

	@media (max-width: 550px) {
		font-size: 0.9em;

		> article {
			padding: 12px;
		}
	}

	@media (max-width: 500px) {
		font-size: 0.8em;

		> article {
			padding: 8px;
		}
	}
}
</style>
