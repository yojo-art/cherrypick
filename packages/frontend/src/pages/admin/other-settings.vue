<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps">
			<div class="_panel" style="padding: 16px;">
				<!-- 実行中 → 強制停止ボタン -->
				<MkButton v-if="progressData.status === 'running'" class="button" inline danger @click="abort()"> Stop </MkButton>

				<!-- キュー待ち中 → キューキャンセルボタン -->
				<MkButton v-else-if="progressData.status === 'queued'" class="button" inline danger @click="abort()"> Cancel Queue </MkButton>

				<!-- 一時停止中 → 続きを実行ボタン -->
				<MkButton v-else-if="progressData.status === 'paused'" class="button" inline primary @click="fullIndexResume()"> {{ i18n.ts._reIndexOpenSearch.resume }} </MkButton>

				<!-- 完了/停止/idle → 再インデックスボタン -->
				<MkButton v-else class="button" inline danger @click="fullIndex()"> {{ i18n.ts._reIndexOpenSearch.title }} </MkButton>

				<MkButton class="button" inline danger @click="reIndex()"> {{ i18n.ts._reCreateOpenSearchIndex.title }} </MkButton>

				<div v-if="progressData.status" style="margin-top: 12px;">
					<progress :value="progressPercent" max="100" style="width: 100%;"/>
					<p style="margin: 4px 0 0; font-size: 0.9em; color: var(--MI_THEME-fg);">
						{{ progressData.current?.toLocaleString() }} / {{ progressData.total?.toLocaleString() }} ({{ progressPercent }}%)
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

type ProgressData = {
	status: string | null;
	current: number | null;
	total: number | null;
	nextRunAt: number | null;
	limitCount: number | null;
	intervalMinutes: number | null;
};

const progressData = ref<ProgressData>({
	status: null,
	current: null,
	total: null,
	nextRunAt: null,
	limitCount: null,
	intervalMinutes: null,
});

const progressPercent = computed(() => {
	const c = progressData.value.current;
	const t = progressData.value.total;
	return (c != null && t != null && t > 0) ? Math.floor((c / t) * 100) : 0;
});

let pollingInterval: ReturnType<typeof setInterval> | null = null;

async function fetchProgress() {
	const res = await misskeyApi('admin/full-index-progress', {});
	if (res) {
		progressData.value = {
			status: res.status,
			current: res.current,
			total: res.total,
			nextRunAt: res.nextRunAt,
			limitCount: res.limitCount,
			intervalMinutes: res.intervalMinutes,
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
		case 'queued': return `Waiting: next run at ${formatTime(progressData.value.nextRunAt)}`;
		case 'completed': return 'Completed';
		case 'aborted': return 'Aborted';
		default: return '';
	}
});

const statusColor = computed(() => {
	switch (progressData.value.status) {
		case 'running': return 'var(--MI_THEME-fgTransparentWeak)';
		case 'paused': return 'var(--MI_THEME-warn)';
		case 'queued': return 'var(--MI_THEME-warn)';
		case 'completed': return 'var(--MI_THEME-fgTransparentWeak)';
		case 'aborted': return 'var(--MI_THEME-error)';
		default: return 'var(--MI_THEME-fgTransparentWeak)';
	}
});

function formatTime(ts: number | null): string {
	if (!ts) return '?';
	const d = new Date(ts);
	return d.toLocaleString();
}

async function fullIndex() {
	const { canceled, result } = await os.form(i18n.ts._reIndexOpenSearch.title, {
		index: {
			type: 'radio',
			label: 'Index',
			options: [
				{ value: 'notes', label: i18n.ts.note },
				{ value: 'reaction', label: i18n.ts.reaction },
				{ value: 'pollVote', label: i18n.ts.poll },
				{ value: 'clipNotes', label: i18n.ts.clip },
				{ value: 'Favorites', label: i18n.ts.favorite },
			],
			default: 'notes',
		},
		limitCount: {
			type: 'number',
			label: 'Limit count per run',
			default: 10000,
			hidden: (v: any) => v.index !== 'notes',
		},
		intervalMinutes: {
			type: 'number',
			label: 'Interval (minutes)',
			default: 5,
			hidden: (v: any) => v.index !== 'notes',
		},
	});
	if (canceled) return;

	await os.apiWithDialog('admin/full-index', {
		index: result.index,
		limitCount: result.index === 'notes' ? result.limitCount : undefined,
		intervalMinutes: result.index === 'notes' ? result.intervalMinutes : undefined,
		discardProgress: true,
	});
	if (result.index === 'notes') {
		setTimeout(() => startPolling(), 500);
	}
}

async function fullIndexResume() {
	const res = await misskeyApi('admin/full-index-progress', {});
	await os.apiWithDialog('admin/full-index', {
		index: 'notes',
		limitCount: res.limitCount ?? undefined,
		intervalMinutes: res.intervalMinutes ?? undefined,
	});
	setTimeout(() => startPolling(), 500);
}

async function abort() {
	await os.apiWithDialog('admin/abort-full-index', {});
	stopPolling();
	await fetchProgress();
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
