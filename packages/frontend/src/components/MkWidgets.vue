<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" class="_gaps_s">
	<template v-if="edit">
		<header :class="$style.editHeader">
			<MkSelect v-model="widgetAdderSelected" :items="widgetAdderSelectedDef" style="margin-bottom: var(--MI-margin)" data-testid="widget-select">
				<template #label>{{ i18n.ts.selectWidget }}</template>
			</MkSelect>
			<MkButton primary data-testid="widget-add" :class="$style.btn" @click="addWidget"><i class="ti ti-plus"></i> {{ i18n.ts.add }}</MkButton>
			<MkButton :class="$style.btn" @click="emit('exit')"><i class="ti ti-check"></i> {{ i18n.ts.close }}</MkButton>
		</header>
		<MkDraggable
			:modelValue="props.widgets"
			direction="vertical"
			withGaps
			group="MkWidgets"
			@update:modelValue="v => emit('updateWidgets', v)"
		>
			<template #default="{ item }">
				<div :class="[$style.widget, $style.customizeContainer]" data-testid="customize-container">
					<header class="handle">
						<span :class="$style.widgetContainerHandle"><i class="ti ti-menu"></i></span>
						<div style="position: absolute; top: 0; left: 35px; font-size: 12px; font-weight: bold; line-height: 33px;">
							{{ i18n.ts._widgets[item.name as keyof typeof i18n.ts._widgets] }}
						</div>
						<button :class="$style.widgetContainerConfig" class="_button" @click.prevent.stop="configWidget(item.id)"><i class="ti ti-settings"></i></button>
						<button :class="$style.widgetContainerRemove" data-testid="customize-container-remove" class="_button" @click.prevent.stop="removeWidget(item)"><i class="ti ti-x"></i></button>
					</header>
					<div>
						<component :is="`widget-${item.name}`" :ref="(el: any) => widgetRefs[item.id] = el" :class="$style.customizeContainerHandleWidget" :widget="item" @updateProps="updateWidget(item.id, $event)"/>
					</div>
				</div>
			</template>
		</MkDraggable>
	</template>
	<component :is="`widget-${widget.name}`" v-for="widget in _widgets" v-else :key="widget.id" :ref="(el: any) => widgetRefs[widget.id] = el" :class="$style.widget" :widget="widget" @updateProps="updateWidget(widget.id, $event)" @contextmenu.stop="onContextmenu(widget, $event)"/>
</div>
</template>

<script lang="ts">
export type Widget = {
	name: string;
	id: string;
	data: Record<string, any>;
};
export type DefaultStoredWidget = {
	place: string | null;
} & Widget;
</script>

<script lang="ts" setup>
import { computed } from 'vue';
import { isLink } from '@@/js/is-link.js';
import type { Component } from 'vue';
import { genId } from '@/utility/id.js';
import MkSelect from '@/components/MkSelect.vue';
import MkButton from '@/components/MkButton.vue';
import MkDraggable from '@/components/MkDraggable.vue';
import { widgets as widgetDefs, federationWidgets } from '@/widgets/index.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { useMkSelect } from '@/composables/use-mkselect.js';

const props = defineProps<{
	widgets: Widget[];
	edit: boolean;
}>();

const _widgetDefs = computed(() => {
	if (instance.federation === 'none') {
		return widgetDefs.filter(x => !federationWidgets.includes(x as any));
	} else {
		return widgetDefs;
	}
});

const _widgets = computed(() => props.widgets.filter(x => _widgetDefs.value.includes(x.name as any)));

const emit = defineEmits<{
	(ev: 'updateWidgets', widgets: Widget[]): void;
	(ev: 'addWidget', widget: Widget): void;
	(ev: 'removeWidget', widget: Widget): void;
	(ev: 'updateWidget', widget: { id: Widget['id']; data: Widget['data']; }): void;
	(ev: 'exit'): void;
}>();

const widgetRefs = {} as Record<string, Component & { configure: () => void }>;

function configWidget(id: string) {
	widgetRefs[id].configure();
}

const {
	model: widgetAdderSelected,
	def: widgetAdderSelectedDef,
} = useMkSelect({
	items: computed(() => [{ label: i18n.ts.none, value: null }, ..._widgetDefs.value.map(x => ({ label: i18n.ts._widgets[x], value: x }))]),
	initialValue: null,
});

function addWidget() {
	if (widgetAdderSelected.value == null) return;

	emit('addWidget', {
		name: widgetAdderSelected.value,
		id: genId(),
		data: {},
	});

	widgetAdderSelected.value = null;
}

function removeWidget(widget: Widget) {
	emit('removeWidget', widget);
}

function updateWidget(id: Widget['id'], data: Widget['data']) {
	emit('updateWidget', { id, data });
}

function onContextmenu(widget: Widget, ev: PointerEvent) {
	const element = ev.target as HTMLElement | null;
	if (element && isLink(element)) return;
	if (element && (['INPUT', 'TEXTAREA', 'IMG', 'VIDEO', 'CANVAS'].includes(element.tagName) || element.attributes.getNamedItem('contenteditable') != null)) return;
	if (window.getSelection()?.toString() !== '') return;

	os.contextMenu([{
		type: 'label',
		text: i18n.ts._widgets[widget.name as typeof widgetDefs[number]],
	}, {
		icon: 'ti ti-settings',
		text: i18n.ts.settings,
		action: () => {
			configWidget(widget.id);
		},
	}], ev);
}
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
}

.btn {
	margin: 10px 0;
	padding: 10px !important;
}

.widget {
	contain: content;
}

.edit {
	&Header {
		margin: 16px 0;

		> * {
			width: 100%;
			padding: 4px 0;
		}
	}
}

.customizeContainer {
	position: relative;
	// cursor: move;
	background: var(--MI_THEME-panel);
	margin: var(--MI-margin) 0;
	border-radius: var(--MI-radius);

	> header {
		position: relative;
		line-height: 25px;

		&Config,
		&Remove {
			position: absolute;
			top: 0;
			padding: 0 8px;
			line-height: 32px;
		}

		&Config {
			right: 30px;
		}

		&Remove {
			right: 5px;
		}
	}

	&Handle {

		&Widget {
			pointer-events: none;
		}
	}

}

.widgetContainerHandle {
	padding: 0 10px;
	cursor: move;
	line-height: 32px;
}

.widgetContainerButton {
	position: absolute;
	top: 0;
	padding: 0 8px;
	line-height: 32px;
}

.widgetContainerConfig {
	composes: widgetContainerButton;
	right: 30px;
}

.widgetContainerRemove {
	composes: widgetContainerButton;
	right: 5px;
}

</style>
