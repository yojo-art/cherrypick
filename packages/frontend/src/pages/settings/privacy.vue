<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps_m">
	<MkSwitch v-model="isLocked" @update:modelValue="save()">{{ i18n.ts.makeFollowManuallyApprove }}<template #caption>{{ i18n.ts.lockedAccountInfo }}</template></MkSwitch>
	<MkSwitch v-if="isLocked" v-model="autoAcceptFollowed" @update:modelValue="save()">{{ i18n.ts.autoAcceptFollowed }}</MkSwitch>

	<MkSwitch v-model="publicReactions" @update:modelValue="save()">
		{{ i18n.ts.makeReactionsPublic }}
		<template #caption>{{ i18n.ts.makeReactionsPublicDescription }}</template>
	</MkSwitch>

	<MkSelect v-model="followingVisibility" @update:modelValue="save()">
		<template #label>{{ i18n.ts.followingVisibility }}</template>
		<option value="public">{{ i18n.ts._ffVisibility.public }}</option>
		<option value="followers">{{ i18n.ts._ffVisibility.followers }}</option>
		<option value="private">{{ i18n.ts._ffVisibility.private }}</option>
	</MkSelect>

	<MkSelect v-model="followersVisibility" @update:modelValue="save()">
		<template #label>{{ i18n.ts.followersVisibility }}</template>
		<option value="public">{{ i18n.ts._ffVisibility.public }}</option>
		<option value="followers">{{ i18n.ts._ffVisibility.followers }}</option>
		<option value="private">{{ i18n.ts._ffVisibility.private }}</option>
	</MkSelect>

	<MkSwitch v-model="hideOnlineStatus" @update:modelValue="save()">
		{{ i18n.ts.hideOnlineStatus }}
		<template #caption>{{ i18n.ts.hideOnlineStatusDescription }}</template>
	</MkSwitch>
	<MkSwitch v-model="noCrawle" @update:modelValue="save()">
		{{ i18n.ts.noCrawle }}
		<template #caption>{{ i18n.ts.noCrawleDescription }}</template>
	</MkSwitch>
	<MkSwitch v-model="preventAiLearning" @update:modelValue="save()">
		{{ i18n.ts.preventAiLearning }}
		<template #caption>{{ i18n.ts.preventAiLearningDescription }}</template>
	</MkSwitch>
	<MkSwitch v-model="isExplorable" @update:modelValue="save()">
		{{ i18n.ts.makeExplorable }}
		<template #caption>{{ i18n.ts.makeExplorableDescription }}</template>
	</MkSwitch>

	<MkSwitch v-model="isIndexable" @update:modelValue="save()">
		{{ i18n.ts.makeIndexable }}
		<span class="_beta">yojo-art</span>
		<template #caption>{{ i18n.ts.makeIndexableDescription }}</template>
	</MkSwitch>
	<MkSelect v-model="searchableBy" @update:modelValue="save()">
		<template #label>{{ i18n.ts._searchbility.tooltip }}<span class="_beta" style="vertical-align: middle;">yojo-art</span></template>
		<option value="public">{{ i18n.ts._searchbility.public }}</option>
		<option value="followersAndReacted">{{ i18n.ts._searchbility.followersAndReacted }}</option>
		<option value="reactedOnly">{{ i18n.ts._searchbility.reactedOnly }}</option>
		<option value="private">{{ i18n.ts._searchbility.private }}</option>
		<template #caption>{{ i18n.ts.makeSearchableByDescription }}</template>
	</MkSelect>

	<FormSection>
		<div class="_gaps_m">
			<MkSwitch v-model="rememberNoteVisibility" @update:modelValue="save()">{{ i18n.ts.rememberNoteVisibility }}</MkSwitch>
			<MkFolder v-if="!rememberNoteVisibility">
				<template #label>{{ i18n.ts.defaultNoteVisibility }}</template>
				<template v-if="defaultNoteVisibility === 'public'" #suffix>{{ i18n.ts._visibility.public }}</template>
				<template v-else-if="defaultNoteVisibility === 'home'" #suffix>{{ i18n.ts._visibility.home }}</template>
				<template v-else-if="defaultNoteVisibility === 'followers'" #suffix>{{ i18n.ts._visibility.followers }}</template>
				<template v-else-if="defaultNoteVisibility === 'specified'" #suffix>{{ i18n.ts._visibility.specified }}</template>

				<div class="_gaps_m">
					<MkSelect v-model="defaultNoteVisibility">
						<option value="public">{{ i18n.ts._visibility.public }}</option>
						<option value="home">{{ i18n.ts._visibility.home }}</option>
						<option value="followers">{{ i18n.ts._visibility.followers }}</option>
						<option value="specified">{{ i18n.ts._visibility.specified }}</option>
					</MkSelect>
				</div>
			</MkFolder>
			<MkSwitch v-model="rememberNoteSearchbility" @update:modelValue="save()">{{ i18n.ts.rememberNoteSearchbility }}</MkSwitch>
			<MkFolder v-if="!rememberNoteSearchbility">
				<template #label>{{ i18n.ts.makeSearchableBy }}</template>
				<template #icon><i class="ti ti-search"></i></template>
				<div class="_gaps_m">
					<MkInfo>{{ i18n.ts.makeSearchableByDescription }}</MkInfo>
					<MkSelect v-model="defaultNoteSearchbility">
						<!--
						<option value="null">{{ i18n.ts.notSet }}</option>
						-->
						<option value="public">{{ i18n.ts._searchbility.public }}</option>
						<option value="followersAndReacted">{{ i18n.ts._searchbility.followersAndReacted }}</option>
						<option value="reactedOnly">{{ i18n.ts._searchbility.reactedOnly }}</option>
						<option value="private">{{ i18n.ts._searchbility.private }}</option>
					</MkSelect>
				</div>
			</MkFolder>
		</div>
	</FormSection>

	<MkSwitch v-model="keepCw" @update:modelValue="save()">{{ i18n.ts.keepCw }}</MkSwitch>
</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkSelect from '@/components/MkSelect.vue';
import FormSection from '@/components/form/section.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInfo from '@/components/MkInfo.vue';
import { misskeyApi } from '@/scripts/misskey-api.js';
import { defaultStore } from '@/store.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { signinRequired } from '@/account.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import FormSlot from '@/components/form/slot.vue';
import { formatDateTimeString } from '@/scripts/format-time-string.js';
import MkInput from '@/components/MkInput.vue';
import * as os from '@/os.js';

const $i = signinRequired();

const isLocked = ref($i.isLocked);
const autoAcceptFollowed = ref($i.autoAcceptFollowed);
const noCrawle = ref($i.noCrawle);
const preventAiLearning = ref($i.preventAiLearning);
const isExplorable = ref($i.isExplorable);
const requireSigninToViewContents = ref($i.requireSigninToViewContents ?? false);
const makeNotesFollowersOnlyBefore = ref($i.makeNotesFollowersOnlyBefore ?? null);
const makeNotesHiddenBefore = ref($i.makeNotesHiddenBefore ?? null);
const isIndexable = ref($i.isIndexable);
const hideOnlineStatus = ref($i.hideOnlineStatus);
const publicReactions = ref($i.publicReactions);
const followingVisibility = ref($i.followingVisibility);
const followersVisibility = ref($i.followersVisibility);
const searchableBy = ref($i.searchableBy);

const defaultNoteVisibility = computed(defaultStore.makeGetterSetter('defaultNoteVisibility'));
const defaultNoteSearchbility = computed(defaultStore.makeGetterSetter('defaultNoteSearchbility'));
const rememberNoteSearchbility = computed(defaultStore.makeGetterSetter('rememberNoteSearchbility'));
const rememberNoteVisibility = computed(defaultStore.makeGetterSetter('rememberNoteVisibility'));
const keepCw = computed(defaultStore.makeGetterSetter('keepCw'));

const makeNotesFollowersOnlyBefore_type = computed(() => {
	if (makeNotesFollowersOnlyBefore.value == null) {
		return null;
	} else if (makeNotesFollowersOnlyBefore.value >= 0) {
		return 'absolute';
	} else {
		return 'relative';
	}
});

const makeNotesHiddenBefore_type = computed(() => {
	if (makeNotesHiddenBefore.value == null) {
		return null;
	} else if (makeNotesHiddenBefore.value >= 0) {
		return 'absolute';
	} else {
		return 'relative';
	}
});

watch([makeNotesFollowersOnlyBefore, makeNotesHiddenBefore], () => {
	save();
});

async function update_requireSigninToViewContents(value: boolean) {
	if (value === true && instance.federation !== 'none') {
		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.ts.acknowledgeNotesAndEnable,
		});
		if (canceled) return;
	}

	requireSigninToViewContents.value = value;
	save();
}

function save() {
	console.log(typeof(searchableBy.value));
	console.log(searchableBy.value);

	misskeyApi('i/update', {
		isLocked: !!isLocked.value,
		autoAcceptFollowed: !!autoAcceptFollowed.value,
		noCrawle: !!noCrawle.value,
		preventAiLearning: !!preventAiLearning.value,
		isExplorable: !!isExplorable.value,
		requireSigninToViewContents: !!requireSigninToViewContents.value,
		makeNotesFollowersOnlyBefore: makeNotesFollowersOnlyBefore.value,
		makeNotesHiddenBefore: makeNotesHiddenBefore.value,
		isIndexable: !!isIndexable.value,
		searchableBy: searchableBy.value,
		hideOnlineStatus: !!hideOnlineStatus.value,
		publicReactions: !!publicReactions.value,
		followingVisibility: followingVisibility.value,
		followersVisibility: followersVisibility.value,
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePageMetadata(() => ({
	title: i18n.ts.privacy,
	icon: 'ti ti-lock-open',
}));
</script>
