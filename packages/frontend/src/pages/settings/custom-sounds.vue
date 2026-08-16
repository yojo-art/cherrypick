<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/custom-sounds" :label="i18n.ts._adminSounds.title" :keywords="['sound', 'instance', 'custom']" icon="ti ti-music">
	<div class="_gaps_m">
		<div v-if="customSounds.length === 0" class="_panel" style="padding: 16px;">
			{{ i18n.ts._adminSounds.noSounds }}
		</div>

		<div v-for="sound in customSounds" :key="sound.id" class="_panel" :class="$style.soundItem">
			<div :class="$style.soundName">{{ sound.name }}</div>
			<div :class="$style.soundActions">
				<MkButton inline small @click="playCustomSound(sound.url)"><i class="ti ti-player-play"></i> {{ i18n.ts.listen }}</MkButton>
				<button class="_button" :class="$style.soundDelete" @click="deleteCustomSound(sound)"><i class="ti ti-x"></i></button>
			</div>
		</div>

		<MkButton inline primary @click="addCustomSoundDialog"><i class="ti ti-plus"></i> {{ i18n.ts._adminSounds.add }}</MkButton>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { $i } from '@/i.js';
import MkButton from '@/components/MkButton.vue';
import type * as Misskey from 'misskey-js';
import { playUrl } from '@/utility/sound.js';

const customSounds = ref<Misskey.entities.GetCustomSoundsResponse>([]);

async function loadCustomSounds() {
	try {
		customSounds.value = await misskeyApi('admin/custom-sounds/list');
	} catch (e) {
		console.warn('Failed to load custom sounds', e);
	}
}

function playCustomSound(url: string | null) {
	if (url == null) return;
	playUrl(url, { volume: 1 });
}

async function addCustomSoundDialog() {
	const { canceled, result } = await os.form(i18n.ts._adminSounds.add, {
		name: {
			type: 'string',
			label: i18n.ts._adminSounds.name,
			description: i18n.ts._adminSounds.nameCaption,
		},
		soundFile: {
			type: 'drive-file',
			label: i18n.ts._adminSounds.selectFile,
			validate: async (file: Misskey.entities.DriveFile) => {
				if (!file.type.startsWith('audio')) {
					os.alert({
						type: 'warning',
						title: i18n.ts._soundSettings.driveFileTypeWarn,
						text: i18n.ts._soundSettings.driveFileTypeWarnDescription,
					});
					return false;
				}
				return true;
			},
		},
	});

	if (canceled) return;
	if (result.name.trim() === '' || result.soundFile == null) return;

	await os.apiWithDialog('admin/custom-sounds/create', {
		name: result.name.trim(),
		fileId: result.soundFile.id,
	}, null, {
		'5db26a76-89e1-41f1-9d7d-c435c020f231': {
			title: i18n.ts._adminSounds.fileAlreadyUsedTitle,
			text: i18n.ts._adminSounds.fileAlreadyUsed,
		},
	});
	await loadCustomSounds();
}

async function deleteCustomSound(sound: Misskey.entities.GetCustomSoundsResponse[number]) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.ts._adminSounds.deleteConfirm,
		caption: i18n.ts._adminSounds.deleteConfirmDriveFileNote,
		okText: i18n.ts._adminSounds.delete,
		cancelText: i18n.ts.cancel,
	});
	if (canceled) return;
	await os.apiWithDialog('admin/custom-sounds/delete', { id: sound.id });
	await loadCustomSounds();
}

onMounted(() => {
	if (!$i) return;
	if (!$i.isAdmin && !$i.policies.canManageCustomSounds) return;
	loadCustomSounds();
});

definePage(() => ({
	title: i18n.ts._adminSounds.title,
	icon: 'ti ti-music',
}));
</script>

<style lang="scss" module>
.soundItem {
	display: flex;
	box-sizing: border-box;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 12px;
	border: solid 1px var(--MI_THEME-divider);
}

.soundName {
	font-weight: bold;
	overflow-wrap: anywhere;
}

.soundActions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

.soundDelete {
	margin-left: 4px;
	color: var(--MI_THEME-error);
	border-radius: 6px;

	&:hover {
		background: color-mix(in srgb, var(--MI_THEME-error) 15%, transparent);
	}
}
</style>
