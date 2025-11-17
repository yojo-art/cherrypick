<!--
SPDX-FileCopyrightText: syuilo and misskey-project, kozakura, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :naked="widgetProps.transparent" :showHeader="false">
	<img ref="mascotImage" :class="$style.root">
</MkContainer>
</template>

<script lang="ts" setup>
import { shallowRef, watchEffect } from 'vue';
import { useWidgetPropsManager, WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import { GetFormResultType } from '@/utility/form.js';
import { instance } from '@/instance.js';
import { getProxiedImageUrl } from '@/utility/media-proxy.js';

const name = 'mascot';

const widgetPropsDef = {
	transparent: {
		type: 'boolean' as const,
		default: false,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const mascotImage = shallowRef<HTMLImageElement>();
watchEffect(() => {
	const val = mascotImage.value;
	if (val != null && instance.mascotImageUrl.startsWith('http')) {
		val.src = getProxiedImageUrl(instance.mascotImageUrl);
	}
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.root {
	width: 100%;
	height: auto;
	border: none;
	pointer-events: none;
	color-scheme: light;
}
</style>
