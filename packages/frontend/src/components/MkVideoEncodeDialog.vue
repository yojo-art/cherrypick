<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialog"
	:width="450"
	:height="580"
	:withOkButton="true"
	:okButtonDisabled="false"
	@ok="ok()"
	@close="handleClose()"
	@closed="emit('closed')"
>
	<template #header>{{ i18n.ts.videoCodec }}</template>
	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div class="_gaps_m">
			<div>
				<video
					v-if="videoUrl"
					:src="videoUrl"
					:style="{ width: '100%', maxHeight: '200px', borderRadius: 'var(--MI-radius)', objectFit: 'contain' }"
					controls
				></video>
				<div v-else :style="{ width: '100%', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--MI_THEME-panel)', borderRadius: 'var(--MI-radius)' }">
					<i class="ti ti-movie" style="font-size: 48px; opacity: 0.5;"></i>
				</div>
			</div>

			<div>
				<div :class="$style.tabLabel">{{ i18n.ts.videoCodec }}</div>
				<MkTab
					v-model="codec"
					:tabs="[
						{ key: 'h264', label: i18n.ts._videoCodec.h264 },
						{ key: 'vp9', label: i18n.ts._videoCodec.vp9 },
						{ key: 'copy', label: i18n.ts._videoCodec.copy },
					]"
					:class="[$style.tab, { [$style.reduceBlurEffect]: !prefer.s.useBlurEffect }]"
				>
				</MkTab>
			</div>

			<template v-if="codec !== 'copy'">
				<MkSelect
					v-model="qualityMode" :items="[
						{ value: 'low', label: `${i18n.ts._compression._quality.high}` },
						{ value: 'medium', label: `${i18n.ts._compression._quality.medium}` },
						{ value: 'high', label: `${i18n.ts._compression._quality.low}` },
						{ value: 'manual', label: i18n.ts.bitrateSpecify },
					]"
				>
					<template #label>{{ i18n.ts.quality }}</template>
				</MkSelect>

				<MkInput v-if="qualityMode === 'manual'" v-model="bitrateMbps" type="number" :min="0.1" :step="0.1">
					<template #label>{{ i18n.ts.videoBitrate }}</template>
					<template #suffix>Mbps</template>
				</MkInput>
			</template>

			<MkSwitch v-if="props.allowApplyToAll" v-model="applyToAll">
				<template #label>{{ i18n.ts.applyToAll }}</template>
			</MkSwitch>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { useTemplateRef, ref, computed, onUnmounted } from 'vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkInput from '@/components/MkInput.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkTab from '@/components/MkTab.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';

export type VideoEncodeDialogResult = {
	videoCodec: 'h264' | 'vp9' | 'copy';
	videoQualityLevel: 'low' | 'medium' | 'high' | 'bitrate';
	videoBitrateValue: number | null;
	applyToAll: boolean;
};

const props = defineProps<{
	file: File;
	mode?: 'new' | 'edit';
	defaultCodec?: 'h264' | 'vp9' | 'copy';
	defaultVideoQualityLevel?: 'low' | 'medium' | 'high' | 'manual';
	defaultBitrateValue?: number | null;
	allowApplyToAll?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'done', v: VideoEncodeDialogResult | null): void;
	(ev: 'closed'): void;
}>();

const dialog = useTemplateRef('dialog');

function handleClose() {
	if (props.mode === 'edit') {
		emit('done', null as any);
	}
	dialog.value?.close();
}

function resolveQualityMode(): 'low' | 'medium' | 'high' | 'manual' {
	if (props.defaultVideoQualityLevel === 'manual') return 'manual';
	if (props.defaultVideoQualityLevel === 'low') return 'low';
	if (props.defaultVideoQualityLevel === 'high') return 'high';
	return 'medium';
}

const codec = ref<'h264' | 'vp9' | 'copy'>(props.defaultCodec ?? 'copy');
const qualityMode = ref<'low' | 'medium' | 'high' | 'manual'>(resolveQualityMode());
const bitrateMbps = ref<number>(props.defaultBitrateValue != null ? props.defaultBitrateValue / 1_000_000 : 5);
const applyToAll = ref(false);

const videoUrl = computed(() => {
	if (props.file.type.startsWith('video/')) {
		return URL.createObjectURL(props.file);
	}
	return null;
});

function resolveResult(): VideoEncodeDialogResult {
	return {
		videoCodec: codec.value,
		videoQualityLevel: qualityMode.value,
		videoBitrateValue: qualityMode.value === 'manual' ? bitrateMbps.value * 1_000_000 : null,
		applyToAll: applyToAll.value,
	};
}

async function ok() {
	emit('done', resolveResult());
	await dialog.value?.close();
}

onUnmounted(() => {
	if (videoUrl.value) {
		URL.revokeObjectURL(videoUrl.value);
	}
});
</script>

<style lang="scss" module>
.tab {
	padding: calc(var(--MI-margin) / 2) 0;
	background: var(--MI_THEME-bg);
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	transition: opacity 0.5s, background-color 0.5s;

	&.reduceBlurEffect {
		background-color: color(from var(--MI_THEME-bg) srgb r g b / 1);
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
}

.tabLabel {
	font-size: 0.85em;
	color: var(--MI_THEME-fg);
	user-select: none;
}
</style>
