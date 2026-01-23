<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/privacy" :label="i18n.ts.privacy" :keywords="['privacy']" icon="ti ti-lock-open">
	<div class="_gaps_m">
		<MkFeatureBanner icon="/client-assets/unlocked_3d.png" color="#aeff00">
			<SearchText>{{ i18n.ts._settings.privacyBanner }}</SearchText>
		</MkFeatureBanner>

		<SearchMarker :keywords="['follow', 'lock']">
			<MkSwitch v-model="isLocked" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeFollowManuallyApprove }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.lockedAccountInfo }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<MkDisableSection :disabled="!isLocked">
			<SearchMarker :keywords="['follow', 'auto', 'accept']">
				<MkSwitch v-model="autoAcceptFollowed" @update:modelValue="save()">
					<template #label><SearchLabel>{{ i18n.ts.autoAcceptFollowed }}</SearchLabel></template>
				</MkSwitch>
			</SearchMarker>
		</MkDisableSection>

		<SearchMarker :keywords="['reaction', 'public']">
			<MkSwitch v-model="publicReactions" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeReactionsPublic }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.makeReactionsPublicDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['following', 'visibility']">
			<MkSelect v-model="followingVisibility" :items="followingVisibilityDef" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.followingVisibility }}</SearchLabel></template>
			</MkSelect>
		</SearchMarker>

		<SearchMarker :keywords="['follower', 'visibility']">
			<MkSelect v-model="followersVisibility" :items="followersVisibilityDef" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.followersVisibility }}</SearchLabel></template>
			</MkSelect>
		</SearchMarker>

		<SearchMarker :keywords="['online', 'status']">
			<MkSwitch v-model="hideOnlineStatus" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.hideOnlineStatus }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.hideOnlineStatusDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['crawle', 'index', 'search']">
			<MkSwitch v-model="noCrawle" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.noCrawle }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.noCrawleDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['crawle', 'ai']">
			<MkSwitch v-model="preventAiLearning" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.preventAiLearning }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.preventAiLearningDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['explore']">
			<MkSwitch v-model="isExplorable" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeExplorable }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.makeExplorableDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>
		<SearchMarker :keywords="['indexable','index','search','yojo-art']">
			<MkSwitch v-model="isIndexable" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeIndexable }}</SearchLabel><span class="_beta">yojo-art</span></template>
				<template #caption><SearchKeyword>{{ i18n.ts.makeIndexableDescription }}</SearchKeyword></template>
			</MkSwitch>
		</SearchMarker>
		<SearchMarker :keywords="['searchable','index','search','yojo-art']">
			<MkSelect v-model="searchableBy" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts._searchbility.tooltip }}</SearchLabel><span class="_beta" style="vertical-align: middle;">yojo-art</span></template>
				<option value="public">{{ i18n.ts._searchbility.public }}</option>
				<option value="followersAndReacted">{{ i18n.ts._searchbility.followersAndReacted }}</option>
				<option value="reactedOnly">{{ i18n.ts._searchbility.reactedOnly }}</option>
				<option value="private">{{ i18n.ts._searchbility.private }}</option>
				<template #caption><SearchKeyword>{{ i18n.ts.makeSearchableByDescription }}</SearchKeyword></template>
			</MkSelect>
		</SearchMarker>

		<SearchMarker :keywords="['chat']">
			<FormSection>
				<template #label><SearchLabel>{{ i18n.ts.directMessage }}</SearchLabel></template>

				<div class="_gaps_m">
					<MkInfo v-if="$i.policies.chatAvailability === 'unavailable'">{{ i18n.ts._chat.chatNotAvailableForThisAccountOrServer }}</MkInfo>
					<SearchMarker :keywords="['chat']">
						<MkSelect v-model="chatScope" :items="chatScopeDef" @update:modelValue="save()">
							<template #label><SearchLabel>{{ i18n.ts._chat.chatAllowedUsers }}</SearchLabel></template>
							<template #caption><SearchText>{{ i18n.ts._chat.chatAllowedUsers_note }}</SearchText></template>
						</MkSelect>
					</SearchMarker>
				</div>
			</FormSection>
		</SearchMarker>

		<SearchMarker :keywords="['auto', 'delete', 'notes']">
			<FormSection>
				<template #label><SearchLabel>{{ i18n.ts.autoDeleteNotes }}</SearchLabel></template>

				<div class="_gaps_m">
					<MkInfo>{{ i18n.ts.autoDeleteNotesDescription }}</MkInfo>

					<SearchMarker :keywords="['auto', 'delete', 'enable']">
						<MkInput
							v-model="autoDeleteNotesAfterDays"
							type="number"
							:min="1"
							:max="3650"
							@update:modelValue="saveAutoDelete()"
						>
							<template #label><SearchLabel>{{ i18n.ts.autoDeleteNotesAfterDays }}</SearchLabel></template>
							<template #suffix>{{ i18n.ts._time.day }}</template>
							<template #caption><SearchText>{{ i18n.ts.autoDeleteNotesAfterDaysDescription }}</SearchText></template>
						</MkInput>
					</SearchMarker>

					<SearchMarker :keywords="['favorite', 'keep']">
						<MkSwitch v-model="autoDeleteKeepFavorites" @update:modelValue="saveAutoDelete()">
							<template #label><SearchLabel>{{ i18n.ts.autoDeleteKeepFavorites }}</SearchLabel></template>
							<template #caption><SearchText>{{ i18n.ts.autoDeleteKeepFavoritesDescription }}</SearchText></template>
						</MkSwitch>
					</SearchMarker>

					<MkInfo warn>{{ i18n.ts.autoDeleteNotesWarning }}</MkInfo>
				</div>
			</FormSection>
		</SearchMarker>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';
import type { MkSelectItem } from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkSelect from '@/components/MkSelect.vue';
import FormSection from '@/components/form/section.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { ensureSignin } from '@/i.js';
import { definePage } from '@/page.js';
import FormSlot from '@/components/form/slot.vue';
import { formatDateTimeString } from '@/utility/format-time-string.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import MkInput from '@/components/MkInput.vue';
import * as os from '@/os.js';
import MkDisableSection from '@/components/MkDisableSection.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkFeatureBanner from '@/components/MkFeatureBanner.vue';

const $i = ensureSignin();

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
const autoDeleteNotesAfterDays = ref<number | null>($i?.autoDeleteNotesAfterDays ?? null);
const autoDeleteKeepFavorites = ref($i?.autoDeleteKeepFavorites ?? false);

const {
	model: followingVisibility,
	def: followingVisibilityDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.public, value: 'public' },
		{ label: i18n.ts.followers, value: 'followers' },
		{ label: i18n.ts.private, value: 'private' },
	],
	initialValue: $i.followingVisibility,
});
const {
	model: followersVisibility,
	def: followersVisibilityDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.public, value: 'public' },
		{ label: i18n.ts.followers, value: 'followers' },
		{ label: i18n.ts.private, value: 'private' },
	],
	initialValue: $i.followersVisibility,
});
const {
	model: chatScope,
	def: chatScopeDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts._chat._chatAllowedUsers.everyone, value: 'everyone' },
		{ label: i18n.ts._chat._chatAllowedUsers.followers, value: 'followers' },
		{ label: i18n.ts._chat._chatAllowedUsers.following, value: 'following' },
		{ label: i18n.ts._chat._chatAllowedUsers.mutual, value: 'mutual' },
		{ label: i18n.ts._chat._chatAllowedUsers.none, value: 'none' },
	],
	initialValue: $i.chatScope,
});
const searchableBy = ref($i.searchableBy);

const makeNotesFollowersOnlyBefore_type = computed({
	get: () => {
		if (makeNotesFollowersOnlyBefore.value == null) {
			return null;
		} else if (makeNotesFollowersOnlyBefore.value >= 0) {
			return 'absolute';
		} else {
			return 'relative';
		}
	},
	set(value) {
		if (value === 'relative') {
			makeNotesFollowersOnlyBefore.value = -604800;
		} else if (value === 'absolute') {
			makeNotesFollowersOnlyBefore.value = Math.floor(Date.now() / 1000);
		} else {
			makeNotesFollowersOnlyBefore.value = null;
		}
	},
});

const makeNotesFollowersOnlyBefore_presets = [
	{ label: i18n.ts.oneHour, value: -3600 },
	{ label: i18n.ts.oneDay, value: -86400 },
	{ label: i18n.ts.threeDays, value: -259200 },
	{ label: i18n.ts.oneWeek, value: -604800 },
	{ label: i18n.ts.oneMonth, value: -2592000 },
	{ label: i18n.ts.threeMonths, value: -7776000 },
	{ label: i18n.ts.oneYear, value: -31104000 },
] satisfies MkSelectItem[];

const makeNotesFollowersOnlyBefore_isCustomMode = ref(
	makeNotesFollowersOnlyBefore.value != null &&
	makeNotesFollowersOnlyBefore.value < 0 &&
	!makeNotesFollowersOnlyBefore_presets.some((preset) => preset.value === makeNotesFollowersOnlyBefore.value),
);

const makeNotesFollowersOnlyBefore_selection = computed({
	get: () => makeNotesFollowersOnlyBefore_isCustomMode.value ? 'custom' : makeNotesFollowersOnlyBefore.value,
	set(value) {
		makeNotesFollowersOnlyBefore_isCustomMode.value = value === 'custom';
		if (value !== 'custom') makeNotesFollowersOnlyBefore.value = value;
	},
});

const makeNotesFollowersOnlyBefore_customMonths = computed({
	get: () => makeNotesFollowersOnlyBefore.value ? Math.abs(makeNotesFollowersOnlyBefore.value) / (30 * 24 * 60 * 60) : null,
	set(value) {
		if (value != null && value > 0) makeNotesFollowersOnlyBefore.value = -Math.abs(Math.floor(Number(value))) * 30 * 24 * 60 * 60;
	},
});

const makeNotesHiddenBefore_type = computed({
	get: () => {
		if (makeNotesHiddenBefore.value == null) {
			return null;
		} else if (makeNotesHiddenBefore.value >= 0) {
			return 'absolute';
		} else {
			return 'relative';
		}
	},
	set(value) {
		if (value === 'relative') {
			makeNotesHiddenBefore.value = -604800;
		} else if (value === 'absolute') {
			makeNotesHiddenBefore.value = Math.floor(Date.now() / 1000);
		} else {
			makeNotesHiddenBefore.value = null;
		}
	},
});

const makeNotesHiddenBefore_presets = [
	{ label: i18n.ts.oneHour, value: -3600 },
	{ label: i18n.ts.oneDay, value: -86400 },
	{ label: i18n.ts.threeDays, value: -259200 },
	{ label: i18n.ts.oneWeek, value: -604800 },
	{ label: i18n.ts.oneMonth, value: -2592000 },
	{ label: i18n.ts.threeMonths, value: -7776000 },
	{ label: i18n.ts.oneYear, value: -31104000 },
] satisfies MkSelectItem[];

const makeNotesHiddenBefore_isCustomMode = ref(
	makeNotesHiddenBefore.value != null &&
	makeNotesHiddenBefore.value < 0 &&
	!makeNotesHiddenBefore_presets.some((preset) => preset.value === makeNotesHiddenBefore.value),
);

const makeNotesHiddenBefore_selection = computed({
	get: () => makeNotesHiddenBefore_isCustomMode.value ? 'custom' : makeNotesHiddenBefore.value,
	set(value) {
		makeNotesHiddenBefore_isCustomMode.value = value === 'custom';
		if (value !== 'custom') makeNotesHiddenBefore.value = value;
	},
});

const makeNotesHiddenBefore_customMonths = computed({
	get: () => makeNotesHiddenBefore.value ? Math.abs(makeNotesHiddenBefore.value) / (30 * 24 * 60 * 60) : null,
	set(value) {
		if (value != null && value > 0) makeNotesHiddenBefore.value = -Math.abs(Math.floor(Number(value))) * 30 * 24 * 60 * 60;
	},
});

watch([makeNotesFollowersOnlyBefore, makeNotesHiddenBefore], () => {
	save();
});

onMounted(async () => {
	try {
		const settings = await misskeyApi('i/auto-delete-settings');
		autoDeleteNotesAfterDays.value = settings.autoDeleteNotesAfterDays;
		autoDeleteKeepFavorites.value = settings.autoDeleteKeepFavorites;
	} catch (error) {
		console.error('Failed to load auto-delete settings:', error);
	}
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
		chatScope: chatScope.value,
	});
}

async function saveAutoDelete() {
	await misskeyApi('i/update-auto-delete-settings', {
		autoDeleteNotesAfterDays: autoDeleteNotesAfterDays.value,
		autoDeleteKeepFavorites: !!autoDeleteKeepFavorites.value,
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.privacy,
	icon: 'ti ti-lock-open',
}));
</script>
