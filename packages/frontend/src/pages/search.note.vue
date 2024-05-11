<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<div class="_gaps">
		<MkSearchInput v-model="searchQuery" :autofocus="true" :large="true" type="search" @enter="search">
			<template #prefix><i class="ti ti-search"></i></template>
		</MkSearchInput>
		<MkRadios v-model="searchOrigin" @update:modelValue="search()">
			<option value="combined">{{ i18n.ts.all }}</option>
			<option value="local">{{ i18n.ts.local }}</option>
			<option value="remote">{{ i18n.ts.remote }}</option>
		</MkRadios>
		<MkFolder>
			<template #label>{{ i18n.ts.options }}</template>

			<FormSection>
				<template #label>{{ i18n.ts.specifyUser }}</template>
				<template v-if="user" #suffix>@{{ user.username }}</template>

				<div style="text-align: center;" class="_gaps_m">
					<MkButton v-if="user == null" primary rounded inline style="margin: 0 auto;" @click="selectUser">{{ i18n.ts.selectUser }}</MkButton>
					<MkButton v-else danger rounded inline style="margin: 0 auto;" @click="user = null">{{ i18n.ts.remove }}</MkButton>
				</div>
			</FormSection>
			<MkSwitch v-model="advancedSearch" :disabled="!isAdvancedSearchAvailable">
				{{ i18n.ts._advancedSearch._searchOption.toggleAdvancedSearch }}
			</MkSwitch>
			<MkFolder v-if="advancedSearch" class="_gaps">
				<FormSection>
					<template #label>{{ i18n.ts.fileAttachedOnly }}</template>

					<div style="text-align: center;" class="_gaps_m">
						<MkRadios v-model="isfileOnly" @update:modelValue="search()">
							<option value="combined">{{ i18n.ts._advancedSearch._fileOption.combined }}</option>
							<option value="file-only">{{ i18n.ts._advancedSearch._fileOption.fileAttachedOnly }}</option>
							<option value="no-file">{{ i18n.ts._advancedSearch._fileOption.noFile }}</option>
						</MkRadios>
					</div>
				</FormSection>
				<FormSection>
					<template #label>{{ i18n.ts._advancedSearch._searchOption.toggleDate }}</template>
					<template #caption>{{ i18n.ts._advancedSearch._description.toggleDate }}</template>

					<FormSplit :minWidth="200">
						<MkInput v-model="startDate" type="date" small style="margin-top: 10px;">
							<template #label>{{ i18n.ts._advancedSearch._specifyDate.startDate }}</template>
							<template #prefix><i class="ti ti-calender"></i></template>
						</MkInput>
						<MkInput v-model="endDate" type="date" small style="margin-top: 10px;">
							<template #label>{{ i18n.ts._advancedSearch._specifyDate.endDate }}</template>
							<template #prefix><i class="ti ti-calender"></i></template>
						</MkInput>
					</FormSplit>
				</FormSection>
				<FormSection>
					<template #label>{{ i18n.ts.other }}</template>
					<template #caption>{{ i18n.ts._advancedSearch._description.other }}</template>
					<template #prefix></template>

					<div style="text-align: center;" class="_gaps">
						<MkSwitch v-model="excludeReply">{{ i18n.ts._advancedSearch._searchOption.toggleReply }}</MkSwitch>
						<MkSwitch v-model="excludeNsfw">{{ i18n.ts._advancedSearch._searchOption.toggleNsfw }}</MkSwitch>
					</div>
				</FormSection>
			</MkFolder>
		</MkFolder>
		<div>
			<MkButton large primary gradate rounded style="margin: 0 auto;" @click="search">{{ i18n.ts.search }}</MkButton>
		</div>
	</div>
	<MkFoldableSection v-if="notePagination">
		<template #label>{{ i18n.ts.searchResult }}</template>
		<MkNotes :key="key" :pagination="notePagination"/>
	</MkFoldableSection>
</div>
</template>

<script lang="ts" setup>
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
import MkSearchInput from '@/components/MkSearchInput.vue';
import FormSplit from '@/components/form/split.vue';
import FormSection from '@/components/form/section.vue';

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
const startDate = ref('');
const endDate = ref(formatDateTimeString(addTime(new Date(), 1, 'day'), 'yyyy-MM-dd'));

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

	notePagination.value = {
		endpoint: 'notes/search',
		limit: 10,
		params: {
			query: searchQuery.value,
			userId: user.value ? user.value.id : null,
			origin: searchOrigin.value,
		},
	};

	if (isAdvancedSearchAvailable === true && advancedSearch.value === true) {
		notePagination.value.endpoint = 'notes/advanced-search';
		notePagination.value.params.query = searchQuery.value;
		notePagination.value.params.fileOption = isfileOnly.value;
		notePagination.value.params.excludeNsfw = excludeNsfw.value;
		notePagination.value.params.excludeReply = excludeReply.value;
		notePagination.value.params.startDate = startDate.value;
		notePagination.value.params.endDate = endDate.value;
	}

	if (isLocalOnly.value) notePagination.value.params.host = '.';

	key.value++;
}
</script>
