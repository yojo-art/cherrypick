<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<div class="_gaps">
			<MkFolder>
				<template #label>{{ i18n.ts._role.baseRole }}</template>
				<template #footer>
					<MkButton primary rounded @click="updateBaseRole">{{ i18n.ts.save }}</MkButton>
				</template>
				<div class="_gaps_s">
					<MkInput ref="baseRoleQEl" v-model="baseRoleQ" type="search">
						<template #prefix><i class="ti ti-search"></i></template>
						<template v-if="baseRoleQ != ''" #suffix>
							<button type="button" :class="$style.deleteBtn" tabindex="-1" @click="baseRoleQ = ''; baseRoleQEl?.focus();">
								<i class="ti ti-x"></i>
							</button>
						</template>
					</MkInput>

					<XPolicyEditor
						v-model:rolePolicies="policies"
						:isBaseRole="true"
						:roleQuery="baseRoleQ"
					/>
				</div>
			</MkFolder>
			<div class="_gaps_s">
				<MkFoldableSection>
					<template #header>{{ i18n.ts._role.manualRoles }}</template>
					<div class="_gaps_s">
						<MkRolePreview v-for="role in roles.filter(x => x.target === 'manual')" :key="role.id" :role="role" :forModeration="true"/>
					</div>
				</MkFoldableSection>
				<MkFoldableSection>
					<template #header>{{ i18n.ts._role.conditionalRoles }}</template>
					<div class="_gaps_s">
						<MkRolePreview v-for="role in roles.filter(x => x.target === 'conditional')" :key="role.id" :role="role" :forModeration="true"/>
					</div>
				</MkFoldableSection>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, useTemplateRef } from 'vue';
import XPolicyEditor from './roles.policy-editor.vue';
import MkInput from '@/components/MkInput.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkButton from '@/components/MkButton.vue';
import MkRolePreview from '@/components/MkRolePreview.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { instance, fetchInstance } from '@/instance.js';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import { useRouter } from '@/router.js';
import { deepClone } from '@/utility/clone.js';

const router = useRouter();
const baseRoleQ = ref('');
const baseRoleQEl = useTemplateRef('baseRoleQEl');

const roles = await misskeyApi('admin/roles/list');

const policies = reactive(deepClone(instance.policies));

async function updateBaseRole() {
	await os.apiWithDialog('admin/roles/update-default-policies', {
		//@ts-expect-error misskey-js側の型定義が不十分
		policies,
	});
	fetchInstance(true);
}

function create() {
	router.push('/admin/roles/new');
}

const headerActions = computed(() => [{
	icon: 'ti ti-plus',
	text: i18n.ts._role.new,
	handler: create,
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.roles,
	icon: 'ti ti-badges',
}));
</script>

<style lang="scss" module>
.deleteBtn {
	position: relative;
	z-index: 2;
	margin: 0 auto;
	border: none;
	background: none;
	color: inherit;
	font-size: 0.8em;
	cursor: pointer;
	pointer-events: auto;
	-webkit-tap-highlight-color: transparent;
}
</style>
