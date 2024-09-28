<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialogEl"
	:withOkButton="false"
	@click="cancel()"
	@close="cancel()"
	@closed="$emit('closed')"
>
	<template #header> 予約投稿一覧</template>
	<div v-for="item in notes" :key="item.id">
		<MkSpacer :marginMin="14" :marginMax="16">
			<MkNoteSimple scheduled="true" :note="item.note"/>
		</MkSpacer>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkNoteSimple from '@/components/MkNoteSimple.vue';
import { misskeyApi } from '@/scripts/misskey-api';
const emit = defineEmits<{
	(ev: 'ok', selected: Misskey.entities.UserDetailed): void;
	(ev: 'cancel'): void;
	(ev: 'closed'): void;
}>();

let dialogEl = ref();
const notes = ref([]);
const cancel = () => {
	emit('cancel');
	dialogEl.value.close();
};

onMounted(async () => {
	notes.value = await misskeyApi('notes/list-schedule');
});

</script>

<style lang="scss" module>
</style>
