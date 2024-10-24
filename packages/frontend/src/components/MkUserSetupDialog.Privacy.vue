<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<MkInfo>{{ i18n.ts._initialAccountSetting.theseSettingsCanEditLater }}</MkInfo>

	<MkFolder>
		<template #label>{{ i18n.ts.makeFollowManuallyApprove }}</template>
		<template #icon><i class="ti ti-lock"></i></template>
		<template #suffix>{{ isLocked ? i18n.ts.on : i18n.ts.off }}</template>

		<MkSwitch v-model="isLocked">{{ i18n.ts.makeFollowManuallyApprove }}<template #caption>{{ i18n.ts.lockedAccountInfo }}</template></MkSwitch>
	</MkFolder>

	<MkFolder>
		<template #label>{{ i18n.ts.makeIndexable }}</template>
		<template #icon><i class="ti ti-search"></i></template>
		<template #suffix>{{ isIndexable ? i18n.ts.on : i18n.ts.off }}</template>
		<div class="_gaps_m">
			<MkSwitch v-model="isIndexable">{{ i18n.ts.makeIndexable }}</MkSwitch>
			<MkInfo>{{ i18n.ts.makeIndexableDescription }}</MkInfo>
		</div>
	</MkFolder>

	<MkFolder>
		<template #label>{{ i18n.ts.makeSearchableBy }}</template>
		<template #icon><i class="ti ti-search"></i></template>
		<div class="_gaps_m">
			<MkSelect v-model="searchableBy">
				<option value="public">{{ i18n.ts._searchbility.public }}</option>
				<option value="followersAndReacted">{{ i18n.ts._searchbility.followersAndReacted }}</option>
				<option value="reactedOnly">{{ i18n.ts._searchbility.reactedOnly }}</option>
				<option value="private">{{ i18n.ts._searchbility.private }}</option>
			</MkSelect>
			<MkInfo>{{ i18n.ts.makeSearchableByDescription }}</MkInfo>
		</div>
	</MkFolder>

	<MkFolder>
		<template #label>{{ i18n.ts.hideOnlineStatus }}</template>
		<template #icon><i class="ti ti-eye-off"></i></template>
		<template #suffix>{{ hideOnlineStatus ? i18n.ts.on : i18n.ts.off }}</template>

		<MkSwitch v-model="hideOnlineStatus">{{ i18n.ts.hideOnlineStatus }}<template #caption>{{ i18n.ts.hideOnlineStatusDescription }}</template></MkSwitch>
	</MkFolder>

	<MkFolder>
		<template #label>{{ i18n.ts.noCrawle }}</template>
		<template #icon><i class="ti ti-world-x"></i></template>
		<template #suffix>{{ noCrawle ? i18n.ts.on : i18n.ts.off }}</template>

		<MkSwitch v-model="noCrawle">{{ i18n.ts.noCrawle }}<template #caption>{{ i18n.ts.noCrawleDescription }}</template></MkSwitch>
	</MkFolder>

	<MkFolder>
		<template #label>{{ i18n.ts.preventAiLearning }}</template>
		<template #icon><i class="ti ti-photo-shield"></i></template>
		<template #suffix>{{ preventAiLearning ? i18n.ts.on : i18n.ts.off }}</template>

		<MkSwitch v-model="preventAiLearning">{{ i18n.ts.preventAiLearning }}<template #caption>{{ i18n.ts.preventAiLearningDescription }}</template></MkSwitch>
	</MkFolder>

	<MkInfo>{{ i18n.ts._initialAccountSetting.youCanEditMoreSettingsInSettingsPageLater }}</MkInfo>
</div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { i18n } from '@/i18n.js';
import MkSwitch from '@/components/MkSwitch.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkFolder from '@/components/MkFolder.vue';
import { misskeyApi } from '@/scripts/misskey-api.js';

const isLocked = ref(false);
const isIndexable = ref(true);
const hideOnlineStatus = ref(false);
const noCrawle = ref(false);
const preventAiLearning = ref(true);
const searchableBy = ref('public');

watch([isLocked, hideOnlineStatus, noCrawle, preventAiLearning], () => {
	misskeyApi('i/update', {
		isLocked: !!isLocked.value,
		isIndexable: !!isIndexable.value,
		searchableBy: !!searchableBy.value,
		hideOnlineStatus: !!hideOnlineStatus.value,
		noCrawle: !!noCrawle.value,
		preventAiLearning: !!preventAiLearning.value,
	});
});
</script>

<style lang="scss" module>

</style>
