<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps">
			<SearchMarker markerId="opensearchReindex" :keywords="['opensearch', 'reindex', 'index', 'search']">
				<MkFolder defaultOpen>
					<template #icon><SearchIcon><i class="ti ti-database"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts._reIndexOpenSearch.sectionTitle }}</SearchLabel></template>

					<template v-if="opensearchEnabled">
						<MkInfo warn>{{ i18n.ts._reIndexOpenSearch.warning }}</MkInfo>

						<div :class="$style.description">{{ i18n.ts._reIndexOpenSearch.description }}</div>

						<div class="_gaps">
							<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
								<MkButton class="button" inline danger @click="fullIndex()"> {{ i18n.ts._reIndexOpenSearch.title }} </MkButton>
								<MkButton class="button" inline danger @click="reIndex()"> {{ i18n.ts._reCreateOpenSearchIndex.title }} </MkButton>
							</div>

							<div class="_gaps_s" style="margin-top: 12px;">
								<template v-for="opt in indexOptions" :key="opt.value">
									<div v-if="progressMap[opt.value].status" style="padding-top: 8px; border-top: 1px solid var(--MI_THEME-divider);">
										<p style="margin: 0 0 4px; font-weight: bold;">{{ opt.label }}</p>
										<div style="display: flex; align-items: center; gap: 8px;">
											<progress :value="progressPercentOf(opt.value)" max="100" style="flex: 1; min-width: 0;"></progress>
											<MkButton v-if="isAbortable(opt.value)" class="button" inline danger small @click="abortIndex(opt.value)"> {{ i18n.ts._reIndexOpenSearch.stop }} </MkButton>
										</div>
										<p style="margin: 4px 0 0; font-size: 0.9em; color: var(--MI_THEME-fg);">
											{{ progressDisplayText(opt.value) }}
										</p>
										<p :style="{ margin: '2px 0 0', fontSize: '0.8em', color: statusColorOf(opt.value) }">
											{{ statusTextOf(opt.value) }}
										</p>
									</div>
								</template>
							</div>
						</div>
					</template>
					<MkInfo v-else-if="opensearchEnabled === false">{{ i18n.ts._reIndexOpenSearch.notEnabled }}</MkInfo>
				</MkFolder>
			</SearchMarker>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInfo from '@/components/MkInfo.vue';

type IndexKind = 'notes' | 'reaction' | 'pollVote' | 'clipNotes' | 'Favorites';

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

const indexOptions: { value: IndexKind, label: string }[] = [
	{ value: 'notes', label: i18n.ts.note },
	{ value: 'reaction', label: i18n.ts.reaction },
	{ value: 'pollVote', label: i18n.ts.poll },
	{ value: 'clipNotes', label: i18n.ts.clip },
	{ value: 'Favorites', label: i18n.ts.favorite },
];

const progressMap = ref<Record<IndexKind, ProgressData>>({
	notes: defaultProgress(),
	reaction: defaultProgress(),
	pollVote: defaultProgress(),
	clipNotes: defaultProgress(),
	Favorites: defaultProgress(),
});

const activeIndex = ref<IndexKind>('notes');

// 高度な検索（OpenSearch）が有効かどうか。null は admin/meta 取得前
const opensearchEnabled = ref<boolean | null>(null);

function progressPercentOf(index: IndexKind): number {
	const p = progressMap.value[index];
	const c = p.current;
	const t = p.total;

	// completed で current > 0 なら常に 100%
	if (p.status === 'completed' && c != null && c > 0) {
		return 100;
	}

	const percent = (c != null && t != null && t > 0) ? Math.floor((c / t) * 100) : 0;
	return Math.min(100, percent);
}

function progressDisplayText(index: IndexKind): string {
	const p = progressMap.value[index];
	const c = p.current ?? 0;
	// completed で current > 0 なら概算値(total)ではなく current を分母にして 1/1 感覚にする
	const t = (p.status === 'completed' && c > 0) ? c : (p.total ?? 0);
	const percent = progressPercentOf(index);
	return `${c.toLocaleString()} / ${t.toLocaleString()} (${percent}%)`;
}

let pollingInterval: number | null = null;

async function fetchProgress(index: IndexKind) {
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
	const meta = await misskeyApi('admin/meta');
	opensearchEnabled.value = meta.opensearchEnabled;

	if (!meta.opensearchEnabled) return;

	await fetchAllProgress();
	if (isAnyRunning()) {
		startPolling();
	}
});

onUnmounted(() => {
	stopPolling();
});

function statusTextOf(index: IndexKind): string {
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

function statusColorOf(index: IndexKind): string {
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
			step: 1,
		},
		intervalMinutes: {
			type: 'number',
			label: i18n.ts._reIndexOpenSearch.intervalMinutesLabel,
			default: 5,
			step: 1,
		},
	});
	if (canceled) return;

	// 既に実行中・待機中ならアラートを表示して終了
	const selectedIndex = result.index;
	const selectedProgress = progressMap.value[selectedIndex];
	if (selectedProgress.status === 'running' || selectedProgress.status === 'queued' || selectedProgress.status === 'paused') {
		const selectedLabel = indexOptions.find(opt => opt.value === selectedIndex)?.label ?? selectedIndex;
		await os.alert({
			type: 'warning',
			text: i18n.tsx._reIndexOpenSearch.alreadyRunning({ target: selectedLabel }),
		});
		return;
	}

	// os.form の number は小数も返すため、バックエンドの integer/範囲検証で400にならないよう整数化＋クランプする
	const limitCount = Math.min(100000000, Math.max(1, Math.floor(result.limitCount)));
	const intervalMinutes = Math.min(60, Math.max(1, Math.floor(result.intervalMinutes)));

	await os.apiWithDialog('admin/full-index', {
		index: result.index,
		limitCount,
		intervalMinutes,
		discardProgress: true,
	});
	activeIndex.value = result.index;
	window.setTimeout(() => startPolling(), 500);
}

function isAbortable(index: IndexKind): boolean {
	const status = progressMap.value[index].status;
	return status === 'running' || status === 'queued' || status === 'paused';
}

async function abortIndex(index: IndexKind) {
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
		os.apiWithDialog('admin/recreate-index', {});
	}
}

definePage(() => ({
	title: i18n.ts.other,
	icon: 'ti ti-adjustments',
}));
</script>

<style lang="scss" module>
.description {
	margin: 0;
	font-size: 0.9em;
	color: var(--MI_THEME-fg);
}
</style>
