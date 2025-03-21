<!--
SPDX-FileCopyrightText: syuilo and misskey-project yojo-art team
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="meta" class="rsqzvsbo">
	<MkFeaturedPhotos class="bg"/>
	<div class="shape1"></div>
	<div class="shape2"></div>
	<!--
	<div class="logo-wrapper">
		<div class="powered-by">Powered by</div>
		<img :src="cherrypicksvg" class="cherrypick"/>
	</div>
-->
	<div class="emojis">
		<MkEmoji :normal="true" :noStyle="true" emoji="👍"/>
		<MkEmoji :normal="true" :noStyle="true" emoji="❤"/>
		<MkEmoji :normal="true" :noStyle="true" emoji="😆"/>
		<MkEmoji :normal="true" :noStyle="true" emoji="🎉"/>
		<MkEmoji :normal="true" :noStyle="true" emoji="🍮"/>
	</div>
	<div class="contents">
		<MkVisitorDashboard/>
	</div>
	<div v-if="instances && instances.length > 0" class="federation">
		<MarqueeText :duration="40">
			<MkA v-for="instance in instances" :key="instance.id" :class="$style.federationInstance" :to="`/instance-info/${instance.host}`" behavior="window">
				<!--<MkInstanceCardMini :instance="instance"/>-->
				<img v-if="instance.iconUrl" class="icon" :src="getInstanceIcon(instance)" alt=""/>
				<span class="name _monospace">{{ instance.host }}</span>
			</MkA>
		</MarqueeText>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import MarqueeText from '@/components/MkMarquee.vue';
import MkFeaturedPhotos from '@/components/MkFeaturedPhotos.vue';
import cherrypicksvg from '/client-assets/cherrypick.svg';
import misskeysvg from '/client-assets/misskey.svg';
import { misskeyApiGet } from '@/scripts/misskey-api.js';
import MkVisitorDashboard from '@/components/MkVisitorDashboard.vue';
import { getProxiedImageUrl } from '@/scripts/media-proxy.js';
import { instance as meta } from '@/instance.js';

const instances = ref<Misskey.entities.FederationInstance[]>();

function getInstanceIcon(instance: Misskey.entities.FederationInstance): string {
	if (!instance.iconUrl) {
		return '';
	}

	return getProxiedImageUrl(instance.iconUrl, 'preview');
}

misskeyApiGet('federation/instances', {
	sort: '+pubSub',
	limit: 20,
	blocked: 'false',
}).then(_instances => {
	instances.value = _instances;
});
</script>

<style lang="scss" scoped>
.rsqzvsbo {
	> .bg {
		position: fixed;
		top: 0;
		right: 0;
		width: 80vw; // 100%からshapeの幅を引いている
		height: 100vh;
	}

	> .shape1 {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: var(--MI_THEME-accent);
		clip-path: polygon(0% 0%, 45% 0%, 20% 100%, 0% 100%);
	}
	> .shape2 {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: var(--MI_THEME-accent);
		clip-path: polygon(0% 0%, 25% 0%, 35% 100%, 0% 100%);
		opacity: 0.5;
	}

	> .logo-wrapper {
		position: fixed;
		top: 36px;
		left: 36px;
		flex: auto;
		color: #fff;
		user-select: none;
		pointer-events: none;

		> .powered-by {
			margin-bottom: 2px;
		}

		> .misskey, .cherrypick {
			width: 140px;
			@media (max-width: 450px) {
				width: 130px;
			}
		}
	}

	> .emojis {
		position: fixed;
		bottom: 32px;
		left: 35px;

		> * {
			margin-right: 8px;
		}

		@media (max-width: 1200px) {
			display: none;
		}
	}

	> .contents {
		position: relative;
		width: min(430px, calc(100% - 32px));
		margin-left: 128px;
		padding: 100px 0 100px 0;

		@media (max-width: 1200px) {
			margin: auto;
		}
	}

	> .federation {
		position: fixed;
		bottom: 16px;
		left: 0;
		right: 0;
		margin: auto;
		background: var(--MI_THEME-acrylicPanel);
		-webkit-backdrop-filter: var(--MI-blur, blur(15px));
		backdrop-filter: var(--MI-blur, blur(15px));
		border-radius: 999px;
		overflow: clip;
		width: 800px;
		padding: 8px 0;

		@media (max-width: 900px) {
			display: none;
		}
	}
}
</style>

<style lang="scss" module>
.federationInstance {
	display: inline-flex;
	align-items: center;
	vertical-align: bottom;
	padding: 6px 12px 6px 6px;
	margin: 0 10px 0 0;
	background: var(--MI_THEME-panel);
	border-radius: 999px;

	> :global(.icon) {
		display: inline-block;
		width: 20px;
		height: 20px;
		margin-right: 5px;
		border-radius: 999px;
	}
}
</style>
