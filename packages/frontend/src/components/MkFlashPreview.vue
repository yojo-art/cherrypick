<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkA :to="`/play/${flash.id}`" class="vhpxefrk _panel" :class="[{ gray: flash.visibility === 'private' }]">
	<article>
		<header>
			<h1 :title="flash.title">{{ flash.title }}</h1>
			<MkButton v-if="isLiked" v-tooltip="i18n.ts.unlike" asLike class="button" rounded primary @click.stop="unlike()"><i class="ti ti-heart"></i><span v-if="flash?.likedCount && flash.likedCount > 0" style="margin-left: 6px;">{{ flash.likedCount }}</span></MkButton>
			<MkButton v-else v-tooltip="i18n.ts.like" asLike class="button" rounded @click.stop="like()"><i class="ti ti-heart"></i><span v-if="flash?.likedCount && flash.likedCount > 0" style="margin-left: 6px;">{{ flash.likedCount }}</span></MkButton>
		</header>
		<p v-if="flash.summary" :title="flash.summary">
			<Mfm class="summaryMfm" :text="flash.summary" :plain="true" :nowrap="true"/>
		</p>
		<footer>
			<img class="icon" :src="flash.user.avatarUrl"/>
			<p>{{ userName(flash.user) }}</p>
		</footer>
	</article>
</MkA>
</template>

<script lang="ts" setup>
import { ref, watchEffect } from 'vue';
import * as Misskey from 'cherrypick-js';
import { userName } from '@/filters/user.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { pleaseLogin } from '@/scripts/please-login.js';

const props = defineProps<{
	flash: Misskey.entities.Flash;
}>();
const isLiked = ref<boolean>(false);
watchEffect(() => {
	isLiked.value = props.flash.isLiked ?? false;
});

function like() {
	pleaseLogin();

	os.apiWithDialog('flash/like', {
		flashId: props.flash.id,
	}).then(() => {
		isLiked.value = true;
	});
}

async function unlike() {
	pleaseLogin();

	const confirm = await os.confirm({
		type: 'warning',
		text: i18n.ts.unlikeConfirm,
	});
	if (confirm.canceled) return;
	os.apiWithDialog('flash/unlike', {
		flashId: props.flash.id,
	}).then(() => {
		isLiked.value = false;
	});
}
</script>

<style lang="scss" scoped>
.vhpxefrk {
	display: block;
	padding: 4px 8px 8px;

	&:hover {
		text-decoration: none;
		color: var(--accent);
	}

	&:focus-visible {
		outline-offset: -2px;
	}

	> article {
		padding: 16px;

		> header {
			margin-bottom: 8px;

			> h1 {
				margin: 0;
				font-size: 1em;
				color: var(--urlPreviewTitle);
			}
		}

		> p {
			margin: 0;
			color: var(--urlPreviewText);
			font-size: 0.8em;
			overflow: clip;

			> .summaryMfm {
				display: block;
				width: 100%;
			}
		}

		> footer {
			margin-top: 8px;
			height: 16px;

			> img {
				display: inline-block;
				width: 18px;
				height: 18px;
				margin-right: 4px;
				vertical-align: top;
				border-radius: 999px;
			}

			> p {
				display: inline-block;
				margin: 0;
				color: var(--urlPreviewInfo);
				font-size: 0.8em;
				line-height: 16px;
				vertical-align: top;
			}
		}
	}

	&:global(.gray) {
		--c: var(--bg);
		background-image: linear-gradient(45deg, var(--c) 16.67%, transparent 16.67%, transparent 50%, var(--c) 50%, var(--c) 66.67%, transparent 66.67%, transparent 100%);
		background-size: 16px 16px;
	}

	@media (max-width: 700px) {
	}

	@media (max-width: 550px) {
		// font-size: 12px;

		> article {
			padding: 12px;
		}
	}

	@media (max-width: 500px) {
		// font-size: 10px;

		> article {
			padding: 8px;

			> header {
				margin-bottom: 4px;
			}

			> footer {
				margin-top: 4px;

				> img {
					width: 16px;
					height: 16px;
				}
			}
		}
	}
}

.button {
	min-width: 48px;
	min-height: 48px;
}
</style>
