<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" v-slot="{ type }" :zPriority="'high'" :src="src" @click="modal?.close()" @closed="emit('closed')" @esc="modal?.close()">
	<div :class="{ [$style.root]: true, [$style.asDrawer]: type === 'drawer', _popup: !defaultStore.state.useBlurEffect || !defaultStore.state.useBlurEffectForModal || !defaultStore.state.removeModalBgColorForBlur, _popupAcrylic: defaultStore.state.useBlurEffect && defaultStore.state.useBlurEffectForModal && defaultStore.state.removeModalBgColorForBlur }">
		<div :class="[$style.label, $style.item]">
			{{ i18n.ts._searchbility.tooltip }}
		</div>
		<button key="public" class="_button" :class="[$style.item, { [$style.active]: v === 'public' }]" data-index="1" @click="choose('public')">
			<div :class="$style.icon"><i class="ti ti-world-search"></i></div>
			<div :class="$style.body">
				<span :class="$style.itemTitle">{{ i18n.ts._searchbility.public }}</span>
			</div>
		</button>
		<button key="followersAndReacted" class="_button" :class="[$style.item, { [$style.active]: v === 'followersAndReacted' }]" data-index="2" @click="choose('followersAndReacted')">
			<div :class="$style.icon"><i class="ti ti-user-search"></i></div>
			<div :class="$style.body">
				<span :class="$style.itemTitle">{{ i18n.ts._searchbility.followersAndReacted }}</span>
			</div>
		</button>
		<button key="reactedOnly" class="_button" :class="[$style.item, { [$style.active]: v === 'reactedOnly' }]" data-index="3" @click="choose('reactedOnly')">
			<div :class="$style.icon"><i class="ti ti-lock-search"></i></div>
			<div :class="$style.body">
				<span :class="$style.itemTitle">{{ i18n.ts._searchbility.reactedOnly }}</span>
			</div>
		</button>
		<button key="private" class="_button" :class="[$style.item, { [$style.active]: v === 'private' }]" data-index="4" @click="choose('private')">
			<div :class="$style.icon"><i class="ti ti-mail-search"></i></div>
			<div :class="$style.body">
				<span :class="$style.itemTitle">{{ i18n.ts._searchbility.private }}</span>
			</div>
		</button>

		<MkDivider style="margin: 5px 0;"/>

		<div :class="$style.item">
			<MkSwitch v-model="rememberNoteSearchbility">{{ i18n.ts.rememberNoteSearchbility }}</MkSwitch>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { nextTick, shallowRef, ref, computed } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkModal from '@/components/MkModal.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkDivider from '@/components/MkDivider.vue';
import { i18n } from '@/i18n.js';
import { defaultStore } from '@/store.js';

const modal = shallowRef<InstanceType<typeof MkModal>>();

const props = withDefaults(defineProps<{
	currentSearchbility: typeof Misskey.noteSearchbility[number];
	src?: HTMLElement;
}>(), {
});

const emit = defineEmits<{
	(ev: 'changeSearchbility', v: typeof Misskey.noteSearchbility[number]): void;
	(ev: 'closed'): void;
}>();

const rememberNoteSearchbility = computed(defaultStore.makeGetterSetter('rememberNoteSearchbility'));

const v = ref(props.currentSearchbility);

function choose(searchbility: typeof Misskey.noteSearchbility[number]): void {
	v.value = searchbility;
	emit('changeSearchbility', searchbility);
	nextTick(() => {
		if (modal.value) modal.value.close();
	});
}
</script>

<style lang="scss" module>
.root {
	min-width: 240px;
	padding: 8px 0;

	&.asDrawer {
		padding: 12px 0 max(env(safe-area-inset-bottom, 0px), 12px) 0;
		width: 100%;
		border-radius: 24px;
		border-bottom-right-radius: 0;
		border-bottom-left-radius: 0;

		.label {
			pointer-events: none;
			font-size: 12px;
			padding-bottom: 4px;
			opacity: 0.7;
		}

		.item {
			font-size: 14px;
			padding: 10px 24px;
		}
	}
}

.label {
	pointer-events: none;
	font-size: 10px;
	padding-bottom: 4px;
	opacity: 0.7;
}

.item {
	display: flex;
	padding: 8px 14px;
	font-size: 12px;
	text-align: left;
	width: 100%;
	box-sizing: border-box;

	&:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	&:active {
		background: rgba(0, 0, 0, 0.1);
	}

	&.active {
		color: var(--accent);
	}
}

.icon {
	display: flex;
	justify-content: center;
	align-items: center;
	margin-right: 10px;
	width: 16px;
	top: 0;
	bottom: 0;
	margin-top: auto;
	margin-bottom: auto;
}

.body {
	flex: 1 1 auto;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.itemTitle {
	display: block;
	font-weight: bold;
}

.itemDescription {
	opacity: 0.6;
}
</style>
