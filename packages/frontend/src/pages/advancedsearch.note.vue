<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
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
			<template #label>{{ i18n.ts._advancedSearch.options }}</template>

			<div class="_gaps_m">
				<!-- ファイル付き検索 -->
				<MkFolder :defaultOpen="true">
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
				<!-- ユーザー指定 -->
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
				<!-- nsfw -->
				<MkFolder :defaultOpen="true">
					<template #label>{{ i18n.ts.specifyUser }}</template>
					<template v-if="" #suffix></template>

					<div style="text-align: center;" class="_gaps">
						<div v-if=""></div>
						<div>
							<MkSwitch v-model="excludeNsfw"></MkSwitch>
						</div>
					</div>
				</MkFolder>
			</div>
		</MkFolder>
	</div>
</div>
</template>

<script lang="ts" setup>
import { defineComponent, ref } from 'vue';
import type { MiUser } from '@/models/User.js';
import MkNotes from '@/components/MkNotes.vue';
import MkInput from '@/components/MkInput.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkButton from '@/components/MkButton.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkFolder from '@/components/MkFolder.vue';
import { useRouter } from '@/router/supplier.js';
import { formatDateTimeString } from '@/scripts/format-time-string.js';
import { addTime } from '@/scripts/time.js';

const router = useRouter();

const key = ref(0);
const searchQuery = ref('');
const searchOrigin = ref('combined');
const isfileOnly = ref('combined');
const notePagination = ref();
const user = ref<any>(null);
const isLocalOnly = ref(false);
const excludeNsfw = ref(true);
const excludeReply = ref('');
const startDate = ref(formatDateTimeString(addTime(new Date(), 1, 'day'), 'yyyy-MM-dd'));
const startTime = ref('00:00');
const endDate = ref('');
const endTime = ref('');

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
		endpoint: 'notes/advanced-search',
		limit: 10,
		params: {
			query: searchQuery.value,
			userId: user.value ? user.value.id : null,
			origin: searchOrigin.value,
			fileOption: isfileOnly.value,
			startDate: startDate.value,
			endDate: endDate.value,
			excludeNsfw: excludeNsfw.value,
			excludeReply: excludeReply.value,
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
