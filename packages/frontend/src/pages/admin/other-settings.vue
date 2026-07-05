<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps">
			<div class="_panel" style="padding: 16px;">
				<div style="margin-bottom: 12px;">
					<select v-model="activeIndex" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--MI_THEME-divider); background: var(--MI_THEME-bg); color: var(--MI_THEME-fg);">
						<option v-for="opt in indexOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
					</select>
				</div>

				<!-- 実行中 → 強制停止ボタン -->
				<MkButton v-if="currentProgress.status === 'running'" class="button" inline danger @click="abort()"> {{ i18n.ts._reIndexOpenSearch.stop }} </MkButton>

				<!-- キュー待ち中 → キューキャンセルボタン -->
				<MkButton v-else-if="currentProgress.status === 'queued'" class="button" inline danger @click="abort()"> {{ i18n.ts._reIndexOpenSearch.cancelQueue }} </MkButton>

				<!-- 一時停止中 → 続きを実行ボタン -->
				<MkButton v-else-if="currentProgress.status === 'paused'" class="button" inline primary @click="fullIndexResume()"> {{ i18n.ts._reIndexOpenSearch.resume }} </MkButton>

				<!-- 完了/停止/idle → 再インデックスボタン -->
				<MkButton v-else class="button" inline danger @click="fullIndex()"> {{ i18n.ts._reIndexOpenSearch.title }} </MkButton>

				<MkButton class="button" inline danger @click="reIndex()"> {{ i18n.ts._reCreateOpenSearchIndex.title }} </MkButton>

				<div class="_gaps_s" style="margin-top: 12px;">
					<template v-for="opt in indexOptions" :key="opt.value">
						<div v-if="progressMap[opt.value].status" style="padding-top: 8px; border-top: 1px solid var(--MI_THEME-divider);">
							<p style="margin: 0 0 4px; font-weight: bold;">{{ opt.label }}</p>
							<div style="display: flex; align-items: center; gap: 8px;">
								<progress :value="progressPercentOf(opt.value)" max="100" style="flex: 1; min-width: 0;"/>
								<MkButton v-if="isAbortable(opt.value)" class="button" inline danger small @click="abortIndex(opt.value)"> {{ i18n.ts._reIndexOpenSearch.stop }} </MkButton>
							</div>
							<p style="margin: 4px 0 0; font-size: 0.9em; color: var(--MI_THEME-fg);">
								{{ progressMap[opt.value].current?.toLocaleString() }} / {{ progressMap[opt.value].total?.toLocaleString() }} ({{ progressPercentOf(opt.value) }}%)
							</p>
							<p :style="{ margin: '2px 0 0', fontSize: '0.8em', color: statusColorOf(opt.value) }">
								{{ statusTextOf(opt.value) }}
							</p>
						</div>
					</template>
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

const defaultProgress = (): ProgressData => ({
	status: null,
	current: null,
	total: null,
	nextRunAt: null,
	limitCount: null,
	intervalMinutes: null,
});

const indexOptions = [
	{ value: 'notes', label: i18n.ts.note },
	{ value: 'reaction', label: i18n.ts.reaction },
	{ value: 'pollVote', label: i18n.ts.poll },
	{ value: 'clipNotes', label: i18n.ts.clip },
	{ value: 'Favorites', label: i18n.ts.favorite },
];

const progressMap = ref<Record<string, ProgressData>>({
	notes: defaultProgress(),
	reaction: defaultProgress(),
	pollVote: defaultProgress(),
	clipNotes: defaultProgress(),
	Favorites: defaultProgress(),
});

const activeIndex = ref('notes');
const currentProgress = computed(() => progressMap.value[activeIndex.value]);

function progressPercentOf(index: string): number {
	const p = progressMap.value[index];
	const c = p.current;
	const t = p.total;
	return (c != null && t != null && t > 0) ? Math.floor((c / t) * 100) : 0;
}

let pollingInterval: ReturnType<typeof window.setInterval> | null = null;

async function fetchProgress(index: string) {
	const res = await misskeyApi('admin/full-index-progress', { index });
	if (res) {
		progressMap.value[index] = {
			status: res.status,
			current: res.current,
			total: res.total,
			nextRunAt: res.nextRunAt,
			limitCount: res.limitCount,
			intervalMinutes: res.intervalMinutes,
		};
	}
}

// redis上に存在する（＝status がある）全種別分をまとめて取得する
async function fetchAllProgress() {
	await Promise.all(indexOptions.map(opt => fetchProgress(opt.value)));
}

function isAnyRunning(): boolean {
	return indexOptions.some(opt => progressMap.value[opt.value].status === 'running');
}

async function startPolling() {
	if (pollingInterval) return;
	await fetchAllProgress();
	pollingInterval = window.setInterval(async () => {
		await fetchAllProgress();
		if (!isAnyRunning()) stopPolling();
	}, 3000);
}

function stopPolling() {
	if (pollingInterval) {
		window.clearInterval(pollingInterval);
		pollingInterval = null;
	}
}

onMounted(async () => {
	await fetchAllProgress();
	if (isAnyRunning()) {
		startPolling();
	}
});

onUnmounted(() => {
	stopPolling();
});

function statusTextOf(index: string): string {
	const p = progressMap.value[index];
	switch (p.status) {
		case 'running': return i18n.ts._reIndexOpenSearch.statusRunning;
		case 'paused': return i18n.ts._reIndexOpenSearch.statusPaused;
		case 'queued': return i18n.tsx._reIndexOpenSearch.statusQueued({ time: formatTime(p.nextRunAt) });
		case 'completed': return i18n.ts._reIndexOpenSearch.statusCompleted;
		case 'aborted': return i18n.ts._reIndexOpenSearch.statusAborted;
		default: return '';
	}
}

function statusColorOf(index: string): string {
	switch (progressMap.value[index].status) {
		case 'running': return 'var(--MI_THEME-fgTransparentWeak)';
		case 'paused': return 'var(--MI_THEME-warn)';
		case 'queued': return 'var(--MI_THEME-warn)';
		case 'completed': return 'var(--MI_THEME-fgTransparentWeak)';
		case 'aborted': return 'var(--MI_THEME-error)';
		default: return 'var(--MI_THEME-fgTransparentWeak)';
	}
}

function formatTime(ts: number | null): string {
	if (!ts) return '?';
	const d = new Date(ts);
	return d.toLocaleString();
}

async function fullIndex() {
	const { canceled, result } = await os.form(i18n.ts._reIndexOpenSearch.title, {
		index: {
			type: 'radio',
			label: i18n.ts._reIndexOpenSearch.indexLabel,
			options: indexOptions,
			default: activeIndex.value,
		},
		limitCount: {
			type: 'number',
			label: i18n.ts._reIndexOpenSearch.limitCountLabel,
			default: 10000,
		},
		intervalMinutes: {
			type: 'number',
			label: i18n.ts._reIndexOpenSearch.intervalMinutesLabel,
			default: 5,
		},
	});
	if (canceled) return;

	await os.apiWithDialog('admin/full-index', {
		index: result.index,
		limitCount: result.limitCount,
		intervalMinutes: result.intervalMinutes,
		discardProgress: true,
	});
	activeIndex.value = result.index;
	window.setTimeout(() => startPolling(), 500);
}

async function fullIndexResume() {
	const index = activeIndex.value;
	const res = await misskeyApi('admin/full-index-progress', { index });
	await os.apiWithDialog('admin/full-index', {
		index,
		limitCount: res.limitCount ?? undefined,
		intervalMinutes: res.intervalMinutes ?? undefined,
	});
	window.setTimeout(() => startPolling(), 500);
}

async function abort() {
	const { canceled, result } = await os.form(i18n.ts._reIndexOpenSearch.stopIndexTitle, {
		index: {
			type: 'radio',
			label: i18n.ts._reIndexOpenSearch.indexLabel,
			options: indexOptions,
			default: activeIndex.value,
		},
	});
	if (canceled) return;

	await abortIndex(result.index);
}

function isAbortable(index: string): boolean {
	const status = progressMap.value[index].status;
	return status === 'running' || status === 'queued' || status === 'paused';
}

async function abortIndex(index: string) {
	await os.apiWithDialog('admin/abort-full-index', { index });
	await fetchAllProgress();
	if (!isAnyRunning()) stopPolling();
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

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.other,
	icon: 'ti ti-adjustments',
}));
</script>
