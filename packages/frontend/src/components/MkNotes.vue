<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkPagination v-if="grid" ref="pagingComponent" :pagination="pagination" :disableLoad="disableAutoLoad">
	<template #empty>
		<div class="_fullinfo">
			<img :src="infoImageUrl" class="_ghost"/>
			<div>{{ i18n.ts.noNotes }}</div>
		</div>
	</template>

	<template #default="{ items: user }">
		<div :class="$style.stream">
			<XFiles v-for="item in user" :key="item.user.id" :user="item.user" :note="item"/>
		</div>
	</template>
</MkPagination>

<MkPagination v-else ref="pagingComponent" :pagination="pagination" :disableAutoLoad="disableAutoLoad">
	<template #empty>
		<div class="_fullinfo">
			<img :src="infoImageUrl" class="_ghost"/>
			<div>{{ i18n.ts.noNotes }}</div>
		</div>
	</template>

	<template #default="{ items: notes }">
		<div :class="[$style.root, { [$style.noGap]: noGap }]">
			<MkDateSeparatedList
				ref="notes"
				v-slot="{ item: note }"
				:items="notes"
				:getDate="getDate"
				:direction="pagination.reversed ? 'up' : 'down'"
				:reversed="pagination.reversed"
				:noGap="noGap"
				:ad="true"
				:class="$style.notes"
			>
				<MkNote :key="note._featuredId_ || note._prId_ || note.id" :class="$style.note" :note="note" :withHardMute="true" :notification="notification" :forceShowReplyTargetNote="forceShowReplyTargetNote"/>
			</MkDateSeparatedList>
		</div>
	</template>
</MkPagination>
</template>

<script lang="ts" setup>
import { shallowRef, onMounted } from 'vue';
import type { Paging } from '@/components/MkPagination.vue';
import MkNote from '@/components/MkNote.vue';
import MkDateSeparatedList from '@/components/MkDateSeparatedList.vue';
import XFiles from '@/components/CPTimelineFile.vue';
import MkPagination from '@/components/MkPagination.vue';
import { i18n } from '@/i18n.js';
import { infoImageUrl } from '@/instance.js';
import { globalEvents } from '@/events.js';

const props = defineProps<{
	pagination: Paging;
	noGap?: boolean;
	getDate?: (any) => string; // custom function to separate notes on something that isn't createdAt
	disableAutoLoad?: boolean;
	notification?: boolean;
	forceShowReplyTargetNote?: boolean;
	grid?: boolean;
}>();

const pagingComponent = shallowRef<InstanceType<typeof MkPagination>>();

onMounted(() => {
	globalEvents.on('reloadNotification', () => reloadNote());
});

function reloadNote() {
	return new Promise<void>((res) => {
		pagingComponent.value?.reload().then(() => {
			res();
		});
	});
}

defineExpose({
	pagingComponent,
});
</script>

<style lang="scss" module>
.root {
	&.noGap {
		> .notes {
			background: var(--MI_THEME-panel);
		}
	}

	&:not(.noGap) {
		> .notes {
			background: var(--MI_THEME-bg);

			.note {
				background: var(--MI_THEME-panel);
				border-radius: var(--MI-radius);
			}
		}
	}
}

.stream {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(224px, 1fr));
	grid-gap: 6px;
}

@container (max-width: 785px) {
	.stream {
		grid-template-columns: repeat(auto-fill, minmax(192px, 1fr));
	}
}

@container (max-width: 660px) {
	.stream {
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
	}
}

@container (max-width: 530px) {
	.stream {
		grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
	}
}
</style>
