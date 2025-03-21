<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<template v-for="file in note.files">
	<div
		v-if="(((
			(defaultStore.state.nsfw === 'force' || file.isSensitive)
		) || (defaultStore.state.dataSaver.media && file.type.startsWith('image/'))) &&
			!showingFiles.has(file.id)
		)"
		:class="[$style.filePreview, { [$style.square]: square }]"
		@click="onClick($event, file)"
		@dblclick="onDblClick(file)"
	>
		<MkDriveFileThumbnail
			:file="file"
			fit="cover"
			:highlightWhenSensitive="defaultStore.state.highlightSensitiveMedia"
			:forceBlurhash="true"
			:large="true"
			:class="$style.file"
		/>
		<div :class="$style.sensitive">
			<div>
				<div v-if="file.isSensitive"><i class="ti ti-eye-exclamation"></i> {{ i18n.ts.sensitive }}{{ defaultStore.state.dataSaver.media && file.size ? ` (${bytes(file.size)})` : '' }}</div>
				<div v-else><i class="ti ti-photo"></i> {{ defaultStore.state.dataSaver.media && file.size ? bytes(file.size) : i18n.ts.image }}</div>
				<div>{{ i18n.ts.clickToShow }}</div>
			</div>
		</div>
	</div>
	<MkA v-else :class="[$style.filePreview, { [$style.square]: square }]" :to="notePage(note)">
		<MkDriveFileThumbnail
			:file="file"
			fit="cover"
			:highlightWhenSensitive="defaultStore.state.highlightSensitiveMedia"
			:large="true"
			:class="$style.file"
		/>
		<div :class="$style.indicators">
			<div v-if="['image/gif'].includes(file.type)" :class="$style.indicator">GIF</div>
			<div v-if="['image/apng'].includes(file.type)" :class="$style.indicator">APNG</div>
			<div v-if="file.comment" :class="$style.indicator">ALT</div>
			<div v-if="file.isSensitive" :class="$style.indicator" style="color: var(--MI_THEME-warn);" :title="i18n.ts.sensitive"><i class="ti ti-eye-exclamation"></i></div>
		</div>
	</MkA>
</template>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import * as os from '@/os.js';
import { notePage } from '@/filters/note.js';
import { i18n } from '@/i18n.js';
import { defaultStore } from '@/store.js';
import bytes from '@/filters/bytes.js';
import { confirmR18, wasConfirmR18 } from '@/scripts/check-r18';

import MkDriveFileThumbnail from '@/components/MkDriveFileThumbnail.vue';
import MkRippleEffect from '@/components/MkRippleEffect.vue';

const props = defineProps<{
	note: Misskey.entities.Note;
	square?: boolean;
}>();

const showingFiles = ref<Set<string>>(new Set());
watch(() => props.note.files, () => {
	if (!props.note.files) return;
	for (const file of props.note.files) {
		if (defaultStore.state.nsfw === 'force' || defaultStore.state.dataSaver.media) {
			//nop
		} else if (file.isSensitive) {
			if (defaultStore.state.nsfw !== 'ignore') {
				//nop
			} else {
				if (wasConfirmR18()) {
					showingFiles.value.add(file.id);
				}
			}
		} else {
			showingFiles.value.add(file.id);
		}
	}
}, {
	deep: true,
	immediate: true,
});

async function onClick(ev: MouseEvent, image: Misskey.entities.DriveFile) {
	if (!showingFiles.value.has(image.id)) {
		ev.stopPropagation();
		if (image.isSensitive && defaultStore.state.confirmWhenRevealingSensitiveMedia) {
			if (wasConfirmR18()) {
				const { canceled } = await os.confirm({
					type: 'question',
					text: i18n.ts.sensitiveMediaRevealConfirm,
				});
				if (canceled) return;
			} else {
				if (!await confirmR18()) return;
			}
			showingFiles.value.add(image.id);
		}
	}

	if (defaultStore.state.nsfwOpenBehavior === 'doubleClick') os.popup(MkRippleEffect, { x: ev.clientX, y: ev.clientY }, {});
	if (defaultStore.state.nsfwOpenBehavior === 'click') {
		if (image.isSensitive && !await confirmR18()) return;
		showingFiles.value.add(image.id);
	}
}

async function onDblClick(image: Misskey.entities.DriveFile) {
	if (!showingFiles.value.has(image.id) && defaultStore.state.nsfwOpenBehavior === 'doubleClick') {
		if (image.isSensitive && !await confirmR18()) return;
		showingFiles.value.add(image.id);
	}
}
</script>

<style lang="scss" module>
.square {
	width: 100%;
	height: auto;
	aspect-ratio: 1;
}

.filePreview {
	position: relative;
	height: 128px;
	border-radius: calc(var(--MI-radius) / 2);
	overflow: clip;

	&:hover {
		text-decoration: none;
	}

	&.square {
		height: 100%;
	}
}

.file {
	width: 100%;
	height: 100%;
	border-radius: calc(var(--MI-radius) / 2);
}

.sensitive {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: grid;
  place-items: center;
	font-size: 0.8em;
	text-align: center;
	padding: 8px;
	box-sizing: border-box;
	color: #fff;
	background: rgba(0, 0, 0, 0.5);
	backdrop-filter: blur(5px);
	cursor: pointer;
}

.indicators {
	display: inline-flex;
	position: absolute;
	top: 10px;
	left: 10px;
	pointer-events: none;
	opacity: .5;
	gap: 6px;
}

.indicator {
	/* Hardcode to black because either --MI_THEME-bg or --MI_THEME-fg makes it hard to read in dark/light mode */
	background-color: black;
	border-radius: 6px;
	color: var(--MI_THEME-accentLighten);
	display: inline-block;
	font-weight: bold;
	font-size: 0.8em;
	padding: 2px 5px;
}
</style>
