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
				<MkButton class="button" inline danger @click="fullIndexTest()"> {{ i18n.ts._reIndexOpenSearch.title }} (Test) </MkButton>
				<MkButton v-if="progressData.status === 'paused'" class="button" inline primary @click="fullIndexResume()"> {{ i18n.ts._reIndexOpenSearch.resume }} </MkButton>
				<MkButton class="button" inline danger @click="reIndex()"> {{ i18n.ts._reCreateOpenSearchIndex.title }} </MkButton>

				<div v-if="progressData.status" style="margin-top: 12px;">
					<progress :value="progressData.percent" max="100" style="width: 100%;" />
					<p style="margin: 4px 0 0; font-size: 0.9em; color: var(--MI_THEME-fg);">
						{{ progressData.current?.toLocaleString() }} / {{ progressData.total?.toLocaleString() }} ({{ progressData.percent }}%)
					</p>
					<p :style="{ margin: '2px 0 0', fontSize: '0.8em', color: statusColor }">
						{{ statusText }}
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

const TEST_LIMIT_COUNT = 10000;

type ProgressData = {
	status: string | null;
	current: number | null;
	total: number | null;
	percent: number;
};

const progressData = ref<ProgressData>({
	status: null,
	current: null,
	total: null,
	percent: 0,
});

let pollingInterval: ReturnType<typeof setInterval> | null = null;

async function fetchProgress() {
	const res = await misskeyApi('admin/full-index-progress', {});
	if (res) {
		progressData.value = {
			status: res.status,
			current: res.current,
			total: res.total,
			percent: res.progressPercent ?? 0,
		};
		if (res.status !== 'running' && pollingInterval) {
			stopPolling();
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
	if (progressData.value.status === 'running') {
		startPolling();
	}
});

onUnmounted(() => {
	stopPolling();
});

const statusText = computed(() => {
	switch (progressData.value.status) {
		case 'running': return 'Running...';
		case 'paused': return 'Paused (click resume to continue)';
		case 'completed': return 'Completed';
		default: return '';
	}
});

const statusColor = computed(() => {
	switch (progressData.value.status) {
		case 'running': return 'var(--MI_THEME-fgTransparentWeak)';
		case 'paused': return 'var(--MI_THEME-warn)';
		case 'completed': return 'var(--MI_THEME-fgTransparentWeak)';
		default: return 'var(--MI_THEME-fgTransparentWeak)';
	}
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
			discardProgress: true,
		});
		if (select === 'notes') {
			setTimeout(() => startPolling(), 500);
		}
	}
}

async function fullIndexTest() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: `Test re-index ${TEST_LIMIT_COUNT.toLocaleString()} notes?`,
	});
	if (!canceled) {
		await os.apiWithDialog('admin/full-index', {
			index: 'notes',
			limitCount: TEST_LIMIT_COUNT,
			discardProgress: true,
		});
		setTimeout(() => startPolling(), 500);
	}
}

async function fullIndexResume() {
	await os.apiWithDialog('admin/full-index', {
		index: 'notes',
		limitCount: TEST_LIMIT_COUNT,
	});
	setTimeout(() => startPolling(), 500);
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
