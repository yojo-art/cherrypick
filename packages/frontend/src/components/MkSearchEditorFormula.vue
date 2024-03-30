<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<div :class="$style.header">
		<MkSelect v-model="searchType" :class="$style.typeSelect">
			<option value="and"></option>
			<option value="or"></option>
			<option value="not"></option>
		</MkSelect>
		<button v-if="draggable" class="drag-handle _button" :class="$style.dragHandle">
			<i class="ti ti-menu-2"></i>
		</button>
		<button v-if="draggable" class="_button" :class="$style.remove" @click="removeSelf">
			<i class="ti ti-x"></i>
		</button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { v4 as uuid } from 'uuid';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { deepClone } from '@/scripts/clone.js';

const Sortable = defineAsyncComponent(() => import('vuedraggable').then(x => x.default));

const emit = defineEmits<{
	(ev: 'update:modelValue', value: any): void;
	(ev: 'remove'): void;
}>();

const props = defineProps<{
	modelValue: any;
	draggable?: boolean;
}>();

const v = ref(deepClone(props.modelValue));

watch(() => props.modelValue, () => {
	if (JSON.stringify(props.modelValue) === JSON.stringify(v.value)) return;
	v.value = deepClone(props.modelValue);
}, { deep: true });

watch(v, () => {
	emit('update:modelValue', v.value);
}, { deep: true });

const searchType = computed({
	get: () => v.value.type,
	set: (t) => {
		if (t === 'and') v.value.values = [];
		if (t === 'or') v.value.values = [];
		if (t === 'not') v.value.value = { id: uuid(), type: 'isRemote' };
	},
});
</script>
