<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
		<MkFolder>
			<template #label>{{ i18n.ts.dataSaver }}</template>

			<div class="_gaps_m">
				<MkInfo>{{ i18n.ts.reloadRequiredToApplySettings }}</MkInfo>

				<div class="_buttons">
					<MkButton inline @click="enableAllDataSaver">{{ i18n.ts.enableAll }}</MkButton>
					<MkButton inline @click="disableAllDataSaver">{{ i18n.ts.disableAll }}</MkButton>
				</div>
				<div class="_gaps_m">
					<MkSwitch v-model="dataSaver.media">
						{{ i18n.ts._dataSaver._media.title }}
					</MkSwitch>
					<MkSwitch v-model="dataSaver.avatar">
						{{ i18n.ts._dataSaver._avatar.title }}
					</MkSwitch>
					<MkSwitch v-model="dataSaver.urlPreview">
						{{ i18n.ts._dataSaver._urlPreview.title }}
					</MkSwitch>
					<MkSwitch v-model="dataSaver.code">
						{{ i18n.ts._dataSaver._code.title }}
					</MkSwitch>
				</div>
			</div>
		</MkFolder>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useWidgetPropsManager, WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import { GetFormResultType } from '@/scripts/form.js';
import { i18n } from '@/i18n.js';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from "@/components/MkSwitch.vue";
import MkInfo from "@/components/MkInfo.vue";
import MkFolder from "@/components/MkFolder.vue";
import { defaultStore } from "@/store.js";

const name = 'dataSaver';

const widgetPropsDef = {
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { configure } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const dataSaver = ref(defaultStore.state.dataSaver);

function enableAllDataSaver() {
	const g = { ...defaultStore.state.dataSaver };
	Object.keys(g).forEach((key) => { g[key] = true; });
	dataSaver.value = g;
}

function disableAllDataSaver() {
	const g = { ...defaultStore.state.dataSaver };
	Object.keys(g).forEach((key) => { g[key] = false; });
	dataSaver.value = g;
}

watch(dataSaver, (to) => {
	defaultStore.set('dataSaver', to);
}, {
	deep: true,
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>
