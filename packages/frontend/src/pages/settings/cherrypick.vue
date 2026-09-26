<!--
SPDX-FileCopyrightText: syuilo and misskey-project & noridev and cherrypick-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/cherrypick" label="CherryPick" :keywords="['cherrypick']" icon="ti ti-bulb-filled">
	<div class="_gaps_m">
		<FormSection first>
			<template #label><SearchLabel>{{ i18n.ts._cherrypick.function }}</SearchLabel></template>
			<template #description><SearchText>{{ i18n.ts._cherrypick.functionDescription }}</SearchText></template>
			<div class="_gaps_m">
				<SearchMarker :keywords="['nickname', 'enable']">
					<MkPreferenceContainer k="nicknameEnabled">
						<MkSwitch v-model="nicknameEnabled">
							<template #label><SearchLabel>{{ i18n.ts._cherrypick.nickname }}</SearchLabel></template>
							<template #caption><SearchText>{{ i18n.ts._cherrypick.nicknameDescription }}</SearchText></template>
						</MkSwitch>
					</MkPreferenceContainer>
				</SearchMarker>

				<div class="_gaps_s">
					<SearchMarker :keywords="['nickname', 'enable']">
						<MkPreferenceContainer k="useEnterToSend">
							<MkSwitch v-model="useEnterToSend">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.useEnterToSend }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.useEnterToSendDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker :keywords="['post', 'form', 'visibility', 'hotkey']">
						<MkPreferenceContainer k="postFormVisibilityHotkey">
							<MkSwitch v-model="postFormVisibilityHotkey">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.postFormVisibilityHotkey }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.postFormVisibilityHotkeyDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker :keywords="['show', 'renote', 'note', 'confirm', 'popup']">
						<MkPreferenceContainer k="showRenoteConfirmPopup">
							<MkSwitch v-model="showRenoteConfirmPopup">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.showRenoteConfirmPopup }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.showRenoteConfirmPopupDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker :keywords="['expand', 'note', 'click']">
						<MkPreferenceContainer k="expandOnNoteClick">
							<MkSwitch v-model="expandOnNoteClick">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.expandOnNoteClick }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.expandOnNoteClickDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>

						<MkDisableSection :disabled="!expandOnNoteClick">
							<SearchMarker :keywords="['behavior']">
								<MkPreferenceContainer k="expandOnNoteClickBehavior">
									<MkSelect
										v-model="expandOnNoteClickBehavior"
										:items="[
											{ label: i18n.ts._nsfwOpenBehavior.click, value: 'click' },
											{ label: i18n.ts._nsfwOpenBehavior.doubleClick, value: 'doubleClick' },
										]"
										style="margin-left: 44px;"
									>
										<template #label><SearchLabel>{{ i18n.ts._cherrypick.expandOnNoteClickBehavior }}</SearchLabel></template>
									</MkSelect>
								</MkPreferenceContainer>
							</SearchMarker>
						</MkDisableSection>
					</SearchMarker>
				</div>
			</div>
		</FormSection>

		<SearchMarker :keywords="['patch', 'behavior']">
			<FormSection>
				<template #label><SearchLabel>{{ i18n.ts._cherrypick.patch }}</SearchLabel></template>
				<template #description><SearchText>{{ i18n.ts._cherrypick.patchDescription }}</SearchText></template>
				<div class="_gaps_m">
					<SearchMarker :keywords="['reactable', 'remote', 'reaction', 'react', 'enable']">
						<MkPreferenceContainer k="reactableRemoteReactionEnabled">
							<MkSwitch v-model="reactableRemoteReactionEnabled">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.reactableRemoteReaction }}</SearchLabel></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker :keywords="['show', 'follow', 'message', 'enable']">
						<MkPreferenceContainer k="showFollowingMessageInsteadOfButtonEnabled">
							<MkSwitch v-model="showFollowingMessageInsteadOfButtonEnabled">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.showFollowingMessageInsteadOfButton }}</SearchLabel></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker :keywords="['rename', 'post', 'form', 'nya']">
						<MkPreferenceContainer k="renameTheButtonInPostFormToNya">
							<MkSwitch v-model="renameTheButtonInPostFormToNya">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.renameTheButtonInPostFormToNya }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.renameTheButtonInPostFormToNyaDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>
				</div>
			</FormSection>
		</SearchMarker>

		<SearchMarker :keywords="['ui', 'show', 'display']">
			<FormSection>
				<template #label><SearchLabel>UI</SearchLabel></template>
				<div class="_gaps_m">
					<SearchMarker :keywords="['enable', 'widget']">
						<MkPreferenceContainer k="enableWidgetsArea">
							<MkSwitch v-model="enableWidgetsArea">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.enableWidgetsArea }}</SearchLabel></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>
				</div>
			</FormSection>
		</SearchMarker>

		<SearchMarker :keywords="['behavior', 'lab']">
			<FormSection>
				<template #label><i class="ti ti-flask"></i> <SearchLabel>{{ i18n.ts.cherrypickLabs }}</SearchLabel></template>
				<template #description><SearchText>{{ i18n.ts.cherrypickLabsDescription }}</SearchText></template>
				<div class="_gaps_m">
				</div>
			</FormSection>
		</SearchMarker>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkRadios from '@/components/MkRadios.vue';
import FormSection from '@/components/form/section.vue';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { suggestReload } from '@/utility/reload-suggest.js';
import MkDisableSection from '@/components/MkDisableSection.vue';
import MkPreferenceContainer from '@/components/MkPreferenceContainer.vue';

const nicknameEnabled = prefer.model('nicknameEnabled');
const useEnterToSend = prefer.model('useEnterToSend');
const postFormVisibilityHotkey = prefer.model('postFormVisibilityHotkey');
const showRenoteConfirmPopup = prefer.model('showRenoteConfirmPopup');
const expandOnNoteClick = prefer.model('expandOnNoteClick');
const expandOnNoteClickBehavior = prefer.model('expandOnNoteClickBehavior');
const reactableRemoteReactionEnabled = prefer.model('reactableRemoteReactionEnabled');
const showFollowingMessageInsteadOfButtonEnabled = prefer.model('showFollowingMessageInsteadOfButtonEnabled');
const renameTheButtonInPostFormToNya = prefer.model('renameTheButtonInPostFormToNya');
const enableWidgetsArea = prefer.model('enableWidgetsArea');

watch([
	renameTheButtonInPostFormToNya,
], async () => {
	await prefer.commit('renameTheButtonInPostFormToNyaManualSet', true);
});

watch([
	expandOnNoteClick,
	reactableRemoteReactionEnabled,
	renameTheButtonInPostFormToNya,
	enableWidgetsArea,
], () => {
	suggestReload();
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: 'CherryPick',
	icon: 'ti ti-bulb-filled',
}));
</script>
