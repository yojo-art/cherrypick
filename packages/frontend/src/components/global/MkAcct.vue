<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<span>
	<span>@{{ user.username }}</span>
	<span v-if="user.host || detail || defaultStore.state.showFullAcct" style="opacity: 0.5;">@{{ user.host || host }}</span>
</span>
</template>

<script lang="ts" setup>
import * as Misskey from 'cherrypick-js';
import { toUnicode } from 'punycode.js';
import { host as hostRaw } from '@@/js/config.js';
import { defaultStore } from '@/store.js';

defineProps<{
	user: Misskey.entities.UserLite;
	detail?: boolean;
}>();

const host = toUnicode(hostRaw);
</script>
