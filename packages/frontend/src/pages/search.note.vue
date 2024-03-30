<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<div class="_gaps">
		<MkInput v-model="searchQuery" :large="true" :autofocus="true" type="search" @enter="search">
			<template #prefix><i class="ti ti-search"></i></template>
		</MkInput>
		<MkRadios v-model="searchOrigin" @update:modelValue="search()">
			<option value="combined">{{ i18n.ts.all }}</option>
			<option value="local">{{ i18n.ts.local }}</option>
			<option value="remote">{{ i18n.ts.remote }}</option>
		</MkRadios>
		<MkFolder>
			<template #label>{{ i18n.ts.options }}</template>

			<div class="_gaps_m">
				<!-- <MkSwitch v-model="isLocalOnly">{{ i18n.ts.localOnly }}</MkSwitch> -->
				<MkFolder :defaultOpen="true">
					<template #label>{{ i18n.ts.specifyUser }}</template>
					<template v-if="user" #suffix>@{{ user.username }}</template>

					<div style="text-align: center;" class="_gaps">
						<div v-if="user">@{{ user.username }}</div>
						<div>
							<MkButton v-if="user == null" primary rounded inline @click="selectUser">{{ i18n.ts.selectUser }}</MkButton>
							<MkButton v-else danger rounded inline @click="user = null">{{ i18n.ts.remove }}</MkButton>
						</div>
					</div>
				</MkFolder>
			</div>
		</MkFolder>
		<!-- 高度な検索のトグル -->
		<MkSwitch v-model="advancedSearch" :disabled="!isAdvancedSearchAvailable">{{ i18n.ts._advancedSearch.toggleAdvancedSearch }}</MkSwitch>
		<div v-if="isAdvancedSearchAvailable">
			<!-- toggle nsfw -->
			<MkSwitch v-model="excludeNsfw">{{ i18n.ts._advancedSearch._searchOption.toggleNsfw }}</MkSwitch>
			<MkSwitch v-model="excludeReply">{{ i18n.ts._advancedSearch._searchOption.toggleReply }}</MkSwitch>
			<MkFolder>
				<!-- ファイル付き検索 -->
				<template #label>{{ i18n.ts.fileAttachedOnly }}</template>
				<template v-if="isfileOnly" #suffix></template>

				<div style="text-align: center;" class="_gaps">
					<div>
						<MkRadios v-model="isfileOnly" @update:modelValue="search()">
							<option value="combined">{{ i18n.ts._advancedSearch._fileOption.combined }}</option>
							<option value="file-only">{{ i18n.ts._advancedSearch._fileOption.fileAttachedOnly }}</option>
							<option value="no-file">{{ i18n.ts._advancedSearch._fileOption.noFile }}</option>
						</MkRadios>
					</div>
				</div>
			</MkFolder>
			<MkFolder>
				<!-- 日時指定 -->
				<!-- 日時指定するかトグルボタンで管理する -->
				<template #label>{{ i18n.ts._advancedSearch._searchOption._toggleDate }}</template>
				<template v-if="toggleDate" #suffix></template>

				<div style="text-align: center;" class="_gaps">
					<div>
						<MkSwitch v-model="toggleDate">{{ i18n.ts._advancedSearch._searchOption._toggleDate }}</MkSwitch>
						<MkInput v-if="toggleDate" v-model="startDate" small style="margin-top: 10px;" type="date">
							<template #label>{{ i18n.ts._advancedSearch._specifyDate.startDate }}</template>
						</MkInput>
						<MkInput v-if="toggleDate" v-model="endDate" small style="margin-top: 10px;" type="date">
							<template #label>{{ i18n.ts._advancedSearch._specifyDate.endDate }}</template>
						</MkInput>
					</div>
				</div>
			</MkFolder>
		</div>
		<div>
			<MkButton large primary gradate rounded style="margin: 0 auto;" @click="search">{{ i18n.ts.search }}</MkButton>
		</div>
	</div>

	<MkFoldableSection v-if="notePagination">
		<template #header>{{ i18n.ts.searchResult }}</template>
		<MkNotes :key="key" :pagination="notePagination"/>
	</MkFoldableSection>
</div>
</template>

<script lang="ts" setup>
import { format } from 'util';
import { ref } from 'vue';
import MkNotes from '@/components/MkNotes.vue';
import MkInput from '@/components/MkInput.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkFolder from '@/components/MkFolder.vue';
import { useRouter } from '@/router/supplier.js';
import { instance } from '@/instance.js';
import { $i } from '@/account';
import { formatDateTimeString } from '@/scripts/format-time-string';
import { addTime } from '@/scripts/time';

const router = useRouter();

const key = ref(0);
const searchQuery = ref('');
const searchOrigin = ref('combined');
const notePagination = ref();
const user = ref<any>(null);
const isLocalOnly = ref(false);
const isfileOnly = ref('combined');
const advancedSearch = ref(false);
const excludeNsfw = ref(false);
const excludeReply = ref(false);
const toggleDate = ref(false);
const startDate = ref(formatDateTimeString(addTime(new Date(), 1, 'day'), 'yyyy-MM-dd'));
const endDate = ref('');

const isAdvancedSearchAvailable = ($i != null && instance.policies.canAdvancedSearchNotes ) || ($i != null && $i.policies.canAdvancedSearchNotes );

function selectUser() {
	os.selectUser({ includeSelf: true }).then(_user => {
		user.value = _user;
	});
}

async function search() {
	const query = searchQuery.value.toString().trim();

	if (query == null || query === '') return;

	if (query.startsWith('https://')) {
		const promise = misskeyApi('ap/show', {
			uri: query,
		});

		os.promiseDialog(promise, null, null, i18n.ts.fetchingAsApObject);

		const res = await promise;

		if (res.type === 'User') {
			router.push(`/@${res.object.username}@${res.object.host}`);
		} else if (res.type === 'Note') {
			router.push(`/notes/${res.object.id}`);
		}

		return;
	}

	if (isAdvancedSearchAvailable && advancedSearch.value) {
		notePagination.value = {
			endpoint: 'notes/advanced-search',
			userId: user.value ? user.value.id : null,
			origin: searchOrigin.value,
			fileOption: isfileOnly.value,
			excludeNsfw: excludeNsfw.value,
			excludeReply: excludeReply.value,
		},
	} else {
		notePagination.value = {
			endpoint: 'notes/search',
			userId: user.value ? user.value.id : null,
			origin: searchOrigin.value,
		},
	};

	if (isfileOnly.value !== 'combined') {
		notePagination.value.endpoint = 'notes/search-file';
		notePagination.value.params.fileOption = isfileOnly.value;
	}
	if (isLocalOnly.value) notePagination.value.params.host = '.';

	key.value++;
}
</script>
