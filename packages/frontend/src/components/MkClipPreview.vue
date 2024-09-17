<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkA :to="`/clips/${clip.id}`" :class="$style.link">
	<div :class="$style.root" class="_panel _gaps_s">
		<div :class="$style.header">
			<b>{{ clip.name }}</b>
			<MkButton v-if="favorited" v-tooltip="i18n.ts.unfavorite" asLike rounded primary @click.stop.prevent="unfavorite()"><i class="ti ti-heart-off"></i><span v-if="clip.favoritedCount > 0" style="margin-left: 6px;">{{ clip.favoritedCount }}</span></MkButton>
			<MkButton v-else v-tooltip="i18n.ts.favorite" asLike rounded @click.stop.prevent="favorite()"><i class="ti ti-heart"></i><span v-if="clip.favoritedCount > 0" style="margin-left: 6px;">{{ clip.favoritedCount }}</span></MkButton>
		</div>
		<div :class="$style.description">
			<div v-if="clip.description"><Mfm :text="clip.description" :plain="true" :nowrap="true"/></div>
			<div v-if="clip.lastClippedAt">{{ i18n.ts.updatedAt }}: <MkTime :time="clip.lastClippedAt" mode="detail"/></div>
			<div v-if="clip.notesCount != null">{{ i18n.ts.notesCount }}: {{ number(clip.notesCount) }} / {{ $i?.policies.noteEachClipsLimit }} ({{ i18n.tsx.remainingN({ n: remaining }) }})</div>
		</div>
		<template v-if="!props.noUserInfo">
			<div :class="$style.divider"></div>
			<div>
				<MkAvatar :user="clip.user" :class="$style.userAvatar" indicator link preview/> <MkUserName :user="clip.user" :nowrap="false"/>
			</div>
		</template>
	</div>
</MkA>
</template>

<script lang="ts" setup>
import * as Misskey from 'cherrypick-js';
import { computed, ref, watchEffect } from 'vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/account.js';
import number from '@/filters/number.js';

const props = withDefaults(defineProps<{
	clip: Misskey.entities.Clip;
	noUserInfo?: boolean;
}>(), {
	noUserInfo: false,
});

const favorited = ref(false);

watchEffect(async () => {
	favorited.value = props.clip.isFavorited ?? true;
});
const remaining = computed(() => {
	return ($i?.policies && props.clip.notesCount != null) ? ($i.policies.noteEachClipsLimit - props.clip.notesCount) : i18n.ts.unknown;
});

function favorite() {
	os.apiWithDialog('clips/favorite', {
		clipId: props.clip.id,
	}).then(() => {
		favorited.value = true;
	});
}

async function unfavorite() {
	const confirm = await os.confirm({
		type: 'warning',
		text: i18n.ts.unfavoriteConfirm,
	});
	if (confirm.canceled) return;
	os.apiWithDialog('clips/unfavorite', {
		clipId: props.clip.id,
	}).then(() => {
		favorited.value = false;
	});
}
</script>

<style lang="scss" module>

.header {
	display: flex;
	justify-content: space-between;
}
.link {
	display: block;

	&:focus-visible {
		outline: none;

		.root {
			box-shadow: inset 0 0 0 2px var(--focus);
		}
	}

	&:hover {
		text-decoration: none;
		color: var(--accent);
	}
}

.root {
	padding: 16px;
}

.divider {
	height: 1px;
	background: var(--divider);
}

.description {
	font-size: 90%;
}

.userAvatar {
	width: 32px;
	height: 32px;
}
</style>
