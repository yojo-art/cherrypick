<!--
SPDX-FileCopyrightText: syuilo and misskey-project & noridev and cherrypick-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><MkPageHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :contentMax="800">
		<div>
			<div v-if="tab === 'direct'">
				<MkPagination v-slot="{ items }" ref="pagingComponent" :pagination="directPagination">
					<MkChatPreview v-for="message in items" :key="message.id" :message="message"/>
				</MkPagination>
			</div>
			<div v-else-if="tab === 'groups'">
				<MkPagination v-slot="{ items }" ref="pagingComponent" :pagination="groupsPagination">
					<MkChatPreview v-for="message in items" :key="message.id" :message="message"/>
				</MkPagination>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, markRaw, onActivated, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import { useStream } from '@/stream.js';
import { useRouter } from '@/router/supplier.js';
import { i18n } from '@/i18n.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { $i } from '@/account.js';
import { globalEvents } from '@/events.js';
import MkChatPreview from '@/components/MkChatPreview.vue';
import MkPagination from '@/components/MkPagination.vue';
import { flushNotification } from '@/scripts/check-nortification-delete.js';

const pagingComponent = shallowRef<InstanceType<typeof MkPagination>>();

const router = useRouter();

const key = ref(0);
const tab = ref('direct');
const searchQuery = ref('');
const messagePagination = ref();
const recipientId = ref(null);
const groupId = ref(null);

let messages;
let connection;

const directPagination = {
	endpoint: 'messaging/history' as const,
	limit: 15,
	params: {
		group: false,
	},
};
const groupsPagination = {
	endpoint: 'messaging/history' as const,
	limit: 5,
	params: {
		group: true,
	},
};

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
	messagePagination.value = {
		endpoint: 'messaging/message/search',
		recipientId: recipientId.value,
		groupId: groupId.value,
	};
	key.value++;
}

function onMessage(message) {
	if (message.recipientId) {
		messages = messages.filter(m => !(
			(m.recipientId === message.recipientId && m.userId === message.userId) ||
			(m.recipientId === message.userId && m.userId === message.recipientId)));

		messages.unshift(message);
	} else if (message.groupId) {
		messages = messages.filter(m => m.groupId !== message.groupId);
		messages.unshift(message);
	}
}

function onRead(ids) {
	for (const id of ids) {
		const found = messages.find(m => m.id === id);
		if (found) {
			if (found.recipientId) {
				found.isRead = true;
			} else if (found.groupId) {
				found.reads.push($i.id);
			}
		}
	}
}

function start(ev) {
	os.popupMenu([{
		text: i18n.ts.messagingWithUser,
		icon: 'ti ti-user',
		action: () => { startUser(); },
	}, {
		text: i18n.ts.messagingWithGroup,
		icon: 'ti ti-users',
		action: () => { startGroup(); },
	}], ev.currentTarget ?? ev.target);
}

async function startUser() {
	os.selectUser().then(user => {
		router.push(`/my/messaging/@${Misskey.acct.toString(user)}`);
	});
}

async function startGroup() {
	const groups1 = await misskeyApi('users/groups/owned');
	const groups2 = await misskeyApi('users/groups/joined');
	if (groups1.length === 0 && groups2.length === 0) {
		os.alert({
			type: 'warning',
			title: i18n.ts.youHaveNoGroups,
			text: i18n.ts.joinOrCreateGroup,
		});
		return;
	}
	const { canceled, result: group } = await os.select({
		title: i18n.ts.group,
		items: groups1.concat(groups2).map(group => ({
			value: group, text: group.name,
		})),
	});
	if (canceled) return;
	router.push(`/my/messaging/group/${group.id}`);
}

async function readAllMessagingMessages() {
	await os.apiWithDialog('i/read-all-messaging-messages');
}

onMounted(() => {
	connection = markRaw(useStream().useChannel('messagingIndex'));

	connection.on('message', onMessage);
	connection.on('read', onRead);

	misskeyApi('messaging/history', { group: false }).then(userMessages => {
		misskeyApi('messaging/history', { group: true }).then(groupMessages => {
			const _messages = userMessages.concat(groupMessages);
			_messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			messages = _messages;
		});
	});

	globalEvents.on('openMessage', (ev) => {
		start(ev);
	});
});

onActivated(() => {
	pagingComponent.value?.reload();
});

onUnmounted(() => {
	if (connection) connection.dispose();
});

const headerActions = computed(() => [{
	icon: 'ti ti-plus',
	text: i18n.ts.create,
	handler: start,
}, {
	icon: 'ti ti-check',
	text: i18n.ts.markAllAsRead,
	handler: readAllMessagingMessages,
}, {
	icon: 'ti ti-check',
	text: i18n.ts.notificationFlush,
	handler: () => {
		flushNotification();
	},
}]);

const headerTabs = computed(() => [{
	key: 'direct',
	title: i18n.ts._messaging.direct,
	icon: 'ti ti-users',
}, {
	key: 'groups',
	title: i18n.ts.groups,
	icon: 'ti ti-users-group',
}]);

definePageMetadata(() => ({
	title: i18n.ts.messaging,
	icon: 'ti ti-messages',
}));
</script>

<style lang="scss" module>
</style>
