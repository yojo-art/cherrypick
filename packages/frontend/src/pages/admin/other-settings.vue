<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<FormSuspense :p="init">
			<div class="_gaps">
				<div class="_panel" style="padding: 16px;">
					<MkButton class="button" inline danger @click="fullIndex()"> {{ i18n.ts._reIndexOpenSearch.title }} </MkButton>
					<MkButton class="button" inline danger @click="reIndex()"> {{ i18n.ts._reCreateOpenSearchIndex.title }} </MkButton>
				</div>
			</div>
		</FormSuspense>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import FormSuspense from '@/components/form/suspense.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkButton from '@/components/MkButton.vue';

async function init() {
	//設定値の初期化
}

function save() {
	//設定値の保存
}

async function fullIndex() {
	const { canceled, result: select } = await os.select({
		title: i18n.ts._reIndexOpenSearch.title,
		items: [{
			value: 'notes', text: i18n.ts.note,
		}, {
			value: 'reaction', text: i18n.ts.reaction,
		}, {
			value: 'pollVote', text: i18n.ts.poll,
		}, {
			value: 'clipNotes', text: i18n.ts.clip,
		}, {
			value: 'Favorites', text: i18n.ts.favorite,
		}],
		default: 'reaction',
	});
	if (!canceled) {
		os.apiWithDialog('admin/full-index', {
			index: select,
		});
	}
}

async function reIndex() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.ts._reCreateOpenSearchIndex.quesion,
		okText: i18n.ts.yes,
		cancelText: i18n.ts.no,
	});

	if (!canceled) {
		os.apiWithDialog('admin/recreate-index' );
	}
}

const headerActions = computed(() => [{
	asFullButton: true,
	icon: 'ti ti-check',
	text: i18n.ts.save,
	handler: save,
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.other,
	icon: 'ti ti-adjustments',
}));
</script>
