<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps">
			<div class="_panel" style="padding: 16px;">
				<MkButton class="button" inline danger @click="fullIndex()"> {{ i18n.ts._reIndexOpenSearch.title }} </MkButton>
				<MkButton class="button" inline danger @click="reIndex()"> {{ i18n.ts._reCreateOpenSearchIndex.title }} </MkButton>

				<div v-if="progressData.running || progressData.justCompleted" style="margin-top: 12px;">
					<progress :value="progressData.percent" max="100" style="width: 100%;" />
					<p style="margin: 4px 0 0; font-size: 0.9em; color: var(--MI_THEME-fg);">
						{{ progressData.current?.toLocaleString() }} / {{ progressData.total?.toLocaleString() }} ({{ progressData.percent }}%)
					</p>
					<p v-if="progressData.running" style="margin: 2px 0 0; font-size: 0.8em; color: var(--MI_THEME-fgTransparentWeak);">
						Running...
					</p>
					<p v-else style="margin: 2px 0 0; font-size: 0.8em; color: var(--MI_THEME-fgTransparentWeak);">
						Completed
					</p>
				</div>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkButton from '@/components/MkButton.vue';

type ProgressData = {
	running: boolean;
	current: number | null;
	total: number | null;
	percent: number;
	justCompleted: boolean;
};

const progressData = ref<ProgressData>({
	running: false,
	current: null,
	total: null,
	percent: 0,
	justCompleted: false,
});

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let justCompletedTimeout: ReturnType<typeof setTimeout> | null = null;

async function fetchProgress() {
	const res = await misskeyApi('admin/full-index-progress', {});
	if (res) {
		const wasRunning = progressData.value.running;
		progressData.value = {
			running: res.running,
			current: res.current,
			total: res.total,
			percent: res.progressPercent ?? 0,
			justCompleted: wasRunning && !res.running,
		};
		if (!res.running && pollingInterval) {
			stopPolling();
			if (justCompletedTimeout) clearTimeout(justCompletedTimeout);
			justCompletedTimeout = setTimeout(() => {
				progressData.value.justCompleted = false;
			}, 5000);
		}
	}
}

async function startPolling() {
	if (pollingInterval) return;
	await fetchProgress();
	pollingInterval = setInterval(fetchProgress, 3000);
}

function stopPolling() {
	if (pollingInterval) {
		clearInterval(pollingInterval);
		pollingInterval = null;
	}
}

onMounted(async () => {
	await fetchProgress();
	if (progressData.value.running) {
		startPolling();
	}
});

onUnmounted(() => {
	stopPolling();
	if (justCompletedTimeout) clearTimeout(justCompletedTimeout);
});

async function fullIndex() {
	const { canceled, result: select } = await os.select({
		title: i18n.ts._reIndexOpenSearch.title,
		items: [{
			value: 'notes', label: i18n.ts.note,
		}, {
			value: 'reaction', label: i18n.ts.reaction,
		}, {
			value: 'pollVote', label: i18n.ts.poll,
		}, {
			value: 'clipNotes', label: i18n.ts.clip,
		}, {
			value: 'Favorites', label: i18n.ts.favorite,
		}],
		default: 'notes',
	});
	if (!canceled) {
		await os.apiWithDialog('admin/full-index', {
			index: select,
		});
		if (select === 'notes') {
			// APIが処理を開始してprogressが保存されるまで少し待つ
			setTimeout(() => startPolling(), 500);
		}
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
	handler: () => {},
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.other,
	icon: 'ti ti-adjustments',
}));
</script>
