<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component
	:is="self ? 'MkA' : 'a'" ref="el" style="word-break: break-all;" class="_link" :[attr]="maybeRelativeUrl" :rel="rel ?? 'nofollow noopener'" :target="target"
	:behavior="props.navigationBehavior"
	:title="url_string"
	@click.stop="(ev: MouseEvent) => warningExternalWebsite(ev, url_string)"
>
	<slot></slot>
	<i v-if="target === '_blank' && !hideIcon" class="ti ti-external-link" :class="$style.icon"></i>
</component>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref } from 'vue';
import { url as local } from '@@/js/config.js';
import { maybeMakeRelative } from '@@/js/url.js';
import type { MkABehavior } from '@/components/global/MkA.vue';
import { useTooltip } from '@/use/use-tooltip.js';
import * as os from '@/os.js';
import { isEnabledUrlPreview } from '@/instance.js';
import { warningExternalWebsite } from '@/utility/warning-external-website.js';

const props = withDefaults(defineProps<{
	url: string;
	rel?: null | string;
	navigationBehavior?: MkABehavior;
	host?: null | string;
	hideIcon?: boolean;
}>(), {
	hideIcon: false,
});

const maybeRelativeUrl = maybeMakeRelative(props.url, local);
let self = maybeRelativeUrl !== props.url;
let requestUrl = new URL(props.url);
if (props.host === requestUrl.host && (requestUrl.pathname.startsWith('/clips/') || requestUrl.pathname.startsWith('/play/'))) {
	let split = requestUrl.pathname.split('@');
	requestUrl = new URL(local + split[0] + '@' + (split.length >= 2 ? split[1] : props.host));
	self = true;
}
const url_string = requestUrl.toString();
const attr = self ? 'to' : 'href';
const target = self ? undefined : '_blank';

const el = ref<HTMLElement | { $el: HTMLElement }>();

if (isEnabledUrlPreview.value) {
	useTooltip(el, (showing) => {
		const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkUrlPreviewPopup.vue')), {
			showing,
			url: props.url,
			source: el.value instanceof HTMLElement ? el.value : el.value?.$el,
		}, {
			closed: () => dispose(),
		});
	});
}
</script>

<style lang="scss" module>
.icon {
	padding-left: 2px;
	font-size: .9em;
}
</style>
