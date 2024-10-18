<!--
SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<div class="_gaps">
		<MkInput v-model="searchQuery" :autofocus="true" :large="true" type="search" @enter.prevent="search">
			<template #prefix><i class="ti ti-search"></i></template>
		</MkInput>
		<MkFoldableSection :expanded="true">
			<template #header>{{ i18n.ts.options }}</template>
			<div class="_gaps_m">
				<MkRadios v-model="searchOrigin" @update:modelValue="search()">
					<template #label>{{ i18n.ts.host }}</template>
					<option value="combined" default>{{ i18n.ts.all }}</option>
					<option value="local">{{ i18n.ts.local }}</option>
					<option v-if="noteSearchableScope == 'global'" value="remote">{{ i18n.ts.remote }}</option>
					<option v-if="noteSearchableScope == 'global'" value="specified">{{ i18n.ts.specifyHost }}</option>
				</MkRadios>
				<MkInput v-if="noteSearchableScope === 'global'" v-model="hostInput" :disabled="user != null || searchOrigin == 'combined' || searchOrigin == 'local' || searchOrigin === 'remote'" :large="true" type="search" @enter.prevent="search">
					<template #prefix><i class="ti ti-server"></i></template>
				</MkInput>
				<MkFolder :defaultOpen="true">
					<template #label>{{ i18n.ts.options }}</template>
					<template v-if="user" #suffix>@{{ user.username }}{{ user.host ? `@${user.host}` : "" }}</template>
					<div class="_gaps">
						<div :class="$style.userItem">
							<MkUserCardMini v-if="user" :class="$style.userCard" :user="user" :withChart="false"/>
							<MkButton v-if="user == null && $i != null" transparent :class="$style.addMeButton" @click="selectSelf"><div :class="$style.addUserButtonInner"><span><i class="ti ti-plus"></i><i class="ti ti-user"></i></span><span>{{ i18n.ts.selectSelf }}</span></div></MkButton>
							<MkButton v-if="user == null" transparent :class="$style.addUserButton" @click="selectUser"><div :class="$style.addUserButtonInner"><i class="ti ti-plus"></i><span>{{ i18n.ts.selectUser }}</span></div></MkButton>
							<button class="_button" :class="$style.remove" :disabled="user == null" @click="removeUser"><i class="ti ti-x"></i></button>
						</div>
					</div>
					<FormSection>
						<template #label>{{ i18n.ts._advancedSearch._fileOption.title }}</template>
						<div style="text-align: center;" class="_gaps_m">
							<MkRadios v-model="isfileOnly" @update:modelValue="search()">
								<option value="combined">{{ i18n.ts._advancedSearch._fileOption.combined }}</option>
								<option value="file-only">{{ i18n.ts._advancedSearch._fileOption.fileAttachedOnly }}</option>
								<option value="no-file">{{ i18n.ts._advancedSearch._fileOption.noFile }}</option>
							</MkRadios>
						</div>
					</FormSection>
					<FormSection>
						<template #label>{{ i18n.ts._advancedSearch._fileNsfwOption.title }}</template>

						<div style="text-align: center;" class="_gaps_m">
							<MkRadios v-model="sensitiveFilter" @update:modelValue="search()">
								<option value="combined">{{ i18n.ts._advancedSearch._fileNsfwOption.combined }}</option>
								<option value="withOutSensitive">{{ i18n.ts._advancedSearch._fileNsfwOption.withOutSensitive }}</option>
								<option value="includeSensitive">{{ i18n.ts._advancedSearch._fileNsfwOption.includeSensitive }}</option>
								<option value="sensitiveOnly">{{ i18n.ts._advancedSearch._fileNsfwOption.sensitiveOnly }}</option>
							</MkRadios>
						</div>
					</FormSection>
					<FormSection>
						<template #label>{{ i18n.ts._advancedSearch._reactionSearch.title }}</template>
						<div class="_gaps">
							<MkInput v-model="emojiSearchQuery" :large="true" type="search" @enter.prevent="search"><template #prefix><i class="ti ti-mood-heart"></i></template></MkInput>
							<MkInput v-model="emojiExcludeSearchQuery" :large="true" type="search" @enter.prevent="search"><template #prefix><i class="ti ti-mood-off"></i></template></MkInput>
							<div class="_gaps_m">
								<MkButton @click="updateEmoji">{{ i18n.ts._advancedSearch._reactionSearch.include }}</MkButton>
								<MkButton @click="updateEmojiExclude">{{ i18n.ts._advancedSearch._reactionSearch.exclude }}</MkButton>
							</div>
						</div>
					</FormSection>
					<FormSection>
						<template #label>{{ i18n.ts._advancedSearch._followingFilter.title }}</template>
						<div style="text-align: center;" class="_gaps_m">
							<MkRadios v-model="followingFilter" @update:modelValue="search()">
								<option value="combined">{{ i18n.ts._advancedSearch._followingFilter.combined }}</option>
								<option value="following">{{ i18n.ts._advancedSearch._followingFilter.following }}</option>
								<option value="notFollowing">{{ i18n.ts._advancedSearch._followingFilter.notFollowing }}</option>
							</MkRadios>
						</div>
					</FormSection>
					<FormSection>
						<template #label>{{ i18n.ts.other }}</template>
						<template #caption>{{ i18n.ts._advancedSearch._description.other }}</template>
						<template #prefix></template>

						<div style="text-align: center;" class="_gaps">
							<MkSwitch v-model="excludeReply">{{ i18n.ts._advancedSearch._searchOption.toggleReply }}</MkSwitch>
							<MkSwitch v-model="excludeCW">{{ i18n.ts._advancedSearch._searchOption.toggleCW }}</MkSwitch>
							<MkSwitch v-model="excludeQuote">{{ i18n.ts._advancedSearch._searchOption.toggleQuote }}</MkSwitch>
							<MkSwitch v-model="strictSearch">{{ i18n.ts._advancedSearch._searchOption.toggleStrictSearch }}</MkSwitch>
						</div>
					</FormSection>
				</MkFolder>
			</div>
		</MkFoldableSection>
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
import { ref, toRef } from 'vue';
import type { UserDetailed } from 'cherrypick-js/entities.js';
import MkNotes from '@/components/MkNotes.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkUserCardMini from '@/components/MkUserCardMini.vue';
import { useRouter } from '@/router/supplier.js';
import MkInput from '@/components/MkInput.vue';
import FormSection from '@/components/form/section.vue';
import { $i } from '@/account.js';
import { instance } from '@/instance.js';
import { emojiPicker } from '@/scripts/emoji-picker';

const props = withDefaults(defineProps<{
		query?: string;
		userId?: string;
		username?: string;
		host?: string | null;
		fileAttach?: string;
		fileSensitive?: string;
		reactions?: string;
		reactionsExclude?: string;
		following?: string;
		excludeReply?: boolean;
		excludeCw?: boolean;
		excludeQuote?: boolean;
		strictSearch?: boolean;
	}>(), {
	query: '',
	userId: undefined,
	username: undefined,
	host: '',
	fileAttach: 'combined',
	fileSensitive: 'combined',
	reactions: '',
	reactionsExclude: '',
	following: 'combined',
	excludeReply: false,
	excludeCw: false,
	excludeQuote: false,
	strictSearch: false,
});
const router = useRouter();

const key = ref(0);
const searchQuery = ref(toRef(props, 'query').value);
const notePagination = ref<Paging>();
const user = ref<UserDetailed | null>(null);
const hostInput = ref(toRef(props, 'host').value);
const searchOrigin = ref('combined');
const isLocalOnly = ref(false);
const isfileOnly = ref(toRef(props, 'fileAttach').value);
const sensitiveFilter = ref(toRef(props, 'fileSensitive').value);
const emojiSearchQuery = ref(toRef(props, 'reactions').value);
const emojiExcludeSearchQuery = ref(toRef(props, 'reactionsExclude').value);
const followingFilter = ref(toRef(props, 'following').value);
const excludeReply = ref(toRef(props, 'excludeReply').value);
const excludeCW = ref(toRef(props, 'excludeCw').value);
const excludeQuote = ref(toRef(props, 'excludeQuote').value);
const strictSearch = ref(toRef(props, 'strictSearch').value);
const noteSearchableScope = instance.noteSearchableScope ?? 'local';

function selectUser() {
	os.selectUser({ includeSelf: true, localOnly: instance.noteSearchableScope === 'local' }).then(_user => {
		user.value = _user;
		hostInput.value = _user.host ?? '';
		searchOrigin.value = 'specified';
	});
}

function selectSelf() {
	user.value = $i as UserDetailed | null;
	hostInput.value = null;
	searchOrigin.value = 'local';
}

function removeUser() {
	user.value = null;
	hostInput.value = '';
}

const isApUserName = RegExp('^@[a-zA-Z0-9_.]+@[a-zA-Z0-9-_.]+[a-zA-Z]$');

async function search() {
	const query = searchQuery.value.toString().trim();

	//#region AP lookup
	if (query.startsWith('https://')) {
		const { canceled } = await os.confirm({
			type: 'question',
			text: i18n.ts._searchOrApShow.question,
			okText: i18n.ts._searchOrApShow.lookup,
			cancelText: i18n.ts._searchOrApShow.search,
		});

		if (!canceled) {
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
	} else if (isApUserName.test(query)) {
		const { canceled } = await os.confirm({
			type: 'question',
			text: i18n.ts._searchOrApShow.question,
			okText: i18n.ts._searchOrApShow.lookup,
			cancelText: i18n.ts._searchOrApShow.search,
		});
		if (!canceled) {
			const querys = query.split('@');
			const promise = misskeyApi('users/show', {
				username: querys[1],
				host: querys[2],
			});
			os.promiseDialog(promise, null, null, i18n.ts.fetchingAsApObject);
			const res = await promise;
			if (typeof res.error === 'undefined') {
				router.push(`/@${res.username}@${res.host}`);
			}
		}
	}
	//#endregion

	if (query.length > 1 && !query.includes(' ') && query.startsWith('#')) {
		const confirm = await os.confirm({
			type: 'info',
			text: i18n.ts.openTagPageConfirm,
			okText: i18n.ts.yes,
			cancelText: i18n.ts.no,
		});
		if (!confirm.canceled) {
			router.push(`/tags/${encodeURIComponent(query.substring(1))}`);
			return;
		}
	}
	const reactionsQuery = emojiSearchQuery.value.split(' ').filter( item => item !== '');
	const excludeReactionsQuery = emojiExcludeSearchQuery.value.split(' ').filter( item => item !== '');
	notePagination.value = {
		endpoint: 'notes/advanced-search',
		limit: 10,
		params: {
			query: searchQuery.value,
			...(0 < reactionsQuery.length && { reactions: reactionsQuery }),
			...(0 < excludeReactionsQuery.length && { reactionsExclude: excludeReactionsQuery }),
			userId: user.value ? user.value.id : null,
			...(searchOrigin.value === 'specified' ? { host: hostInput.value } : { origin: searchOrigin.value }),
			fileOption: isfileOnly.value,
			excludeCW: excludeCW.value,
			excludeReply: excludeReply.value,
			excludeQuote: excludeQuote.value,
			sensitiveFilter: sensitiveFilter.value,
			followingFilter: followingFilter.value,
			useStrictSearch: strictSearch.value,
		},
	};
	key.value++;
}

const customEmoji = /^:[a-zA-Z0-9_]+:$/;

async function updateEmoji(ev: MouseEvent) {
	emojiPicker.show(
		ev.currentTarget ?? ev.target,
		emoji => {
			const reaction = customEmoji.test(emoji) ? emoji.slice(0, -1) + '*' : emoji;
			const value = 0 < emojiSearchQuery.value.length ? ' ' + reaction : reaction;
			emojiSearchQuery.value += value;
		},
	);
}

async function updateEmojiExclude(ev: MouseEvent) {
	emojiPicker.show(
		ev.currentTarget ?? ev.target,
		emoji => {
			const reaction = customEmoji.test(emoji) ? emoji.slice(0, -1) + '*' : emoji;
			const value = 0 < emojiSearchQuery.value.length ? ' ' + reaction : reaction;
			emojiExcludeSearchQuery.value += value;
		},
	);
}
</script>
<style lang="scss" module>
.userItem {
	display: flex;
	justify-content: center;
}
.addMeButton {
  border: 2px dashed var(--fgTransparent);
	padding: 12px;
	margin-right: 16px;
}
.addUserButton {
  border: 2px dashed var(--fgTransparent);
	padding: 12px;
	flex-grow: 1;
}
.addUserButtonInner {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: space-between;
	min-height: 38px;
}
.userCard {
	flex-grow: 1;
}
.remove {
	width: 32px;
	height: 32px;
	align-self: center;

	& > i:before {
		color: #ff2a2a;
	}

	&:disabled {
		opacity: 0;
	}
}
</style>
