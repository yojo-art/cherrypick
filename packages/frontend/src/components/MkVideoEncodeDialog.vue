<!--
SPDX-FileCopyrightText: syuilo and misskey-project
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
	@close="dialog?.close()"
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

			<MkSelect v-model="codec" :items="[
				{ value: 'h264', label: i18n.ts._videoCodec.h264 },
				{ value: 'vp9', label: i18n.ts._videoCodec.vp9 },
				{ value: 'copy', label: i18n.ts._videoCodec.copy },
			]">
				<template #label>{{ i18n.ts.videoCodec }}</template>
			</MkSelect>

		<template v-if="codec !== 'copy'">
			<MkSelect v-model="compressionLevel" :items="[
				{ value: 1, label: `${i18n.ts.low} (${i18n.ts._compression._quality.high}; ${i18n.ts._compression._size.large})` },
				{ value: 2, label: `${i18n.ts.medium} (${i18n.ts._compression._quality.medium}; ${i18n.ts._compression._size.medium})` },
				{ value: 3, label: `${i18n.ts.high} (${i18n.ts._compression._quality.low}; ${i18n.ts._compression._size.small})` },
			]">
				<template #label>{{ i18n.ts.quality }}</template>
			</MkSelect>

			<MkSelect v-model="bitrateMode" :items="[
				{ value: 'auto', label: i18n.ts.automatic },
				{ value: 'manual', label: i18n.ts.manualInput },
			]">
				<template #label>{{ i18n.ts.videoBitrateMode }}</template>
			</MkSelect>

			<MkInput v-if="bitrateMode === 'manual'" v-model="bitrateMbps" type="number" :min="0.1" :step="0.1">
				<template #label>{{ i18n.ts.videoBitrateValue }}</template>
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
import { i18n } from '@/i18n.js';

export type VideoEncodeDialogResult = {
	videoCodec: 'h264' | 'vp9' | 'copy';
	compressionLevel: 0 | 1 | 2 | 3;
	videoBitrateMode: 'auto' | 'manual';
	videoBitrateValue: number | null;
	applyToAll: boolean;
};

const props = defineProps<{
	file: File;
	defaultCodec?: 'h264' | 'vp9' | 'copy';
	defaultCompressionLevel?: 0 | 1 | 2 | 3;
	defaultBitrateMode?: 'auto' | 'manual';
	defaultBitrateValue?: number | null;
	allowApplyToAll?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'done', v: VideoEncodeDialogResult): void;
	(ev: 'closed'): void;
}>();

const dialog = useTemplateRef('dialog');

const codec = ref<'h264' | 'vp9' | 'copy'>(props.defaultCodec ?? 'copy');
const compressionLevel = ref<0 | 1 | 2 | 3>(props.defaultCompressionLevel ?? 2);
const bitrateMode = ref<'auto' | 'manual'>(props.defaultBitrateMode ?? 'auto');
const bitrateMbps = ref<number>(props.defaultBitrateValue != null ? props.defaultBitrateValue / 1_000_000 : 5);
const applyToAll = ref(false);

const videoUrl = computed(() => {
	if (props.file.type.startsWith('video/')) {
		return URL.createObjectURL(props.file);
	}
	return null;
});

const videoBitrateValue = computed((): number | null => {
	if (codec.value === 'copy') return null;
	if (bitrateMode.value === 'manual') {
		return bitrateMbps.value * 1_000_000;
	}
	return null;
});

async function ok() {
	emit('done', {
		videoCodec: codec.value,
		compressionLevel: compressionLevel.value,
		videoBitrateMode: bitrateMode.value,
		videoBitrateValue: videoBitrateValue.value,
		applyToAll: applyToAll.value,
	});
	await dialog.value?.close();
}

onUnmounted(() => {
	if (videoUrl.value) {
		URL.revokeObjectURL(videoUrl.value);
	}
});
</script>
