<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	v-if="!muted && !hideByPlugin && !isDeleted"
	ref="rootEl"
	v-hotkey="keymap"
	:class="$style.root"
	tabindex="0"
>
	<div v-if="appearNote.reply && appearNote.reply.replyId && !conversationLoaded" style="padding: 16px">
		<MkButton style="margin: 0 auto;" primary rounded @click="loadConversation">{{ i18n.ts.loadConversation }}</MkButton>
	</div>
	<div v-if="isRenote" :class="$style.renote">
		<MkAvatar v-if="!prefer.s.hideAvatarsInNote" :class="$style.renoteAvatar" :user="note.user" link preview/>
		<MkA v-user-preview="note.userId" :class="$style.renoteName" :to="userPage(note.user)"/>
		<i class="ti ti-repeat" style="margin-right: 4px;"></i>
		<span :class="$style.renoteText">
			<I18n :src="i18n.ts.renotedBy" tag="span">
				<template #user>
					<MkUserName :class="$style.renoteName" :user="note.user"/>
				</template>
			</I18n>
		</span>
		<div :class="$style.renoteInfo">
			<span v-if="note.visibility !== 'public'" style="margin-right: 0.5em;">
				<i v-if="note.visibility === 'home'" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-home"></i>
				<i v-else-if="note.visibility === 'followers'" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-lock"></i>
				<i v-else-if="note.visibility === 'specified'" ref="specified" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-mail"></i>
			</span>
			<span v-if="note.reactionAcceptance != null" style="margin-right: 0.5em;" :class="{ [$style.danger]: ['nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote', 'likeOnly'].includes(<string>note.reactionAcceptance) }" :title="i18n.ts.reactionAcceptance">
				<i v-if="note.reactionAcceptance === 'likeOnlyForRemote'" v-tooltip="i18n.ts.likeOnlyForRemote" class="ti ti-heart-plus"></i>
				<i v-else-if="note.reactionAcceptance === 'nonSensitiveOnly'" v-tooltip="i18n.ts.nonSensitiveOnly" class="ti ti-icons"></i>
				<i v-else-if="note.reactionAcceptance === 'nonSensitiveOnlyForLocalLikeOnlyForRemote'" v-tooltip="i18n.ts.nonSensitiveOnlyForLocalLikeOnlyForRemote" class="ti ti-heart-plus"></i>
				<i v-else-if="note.reactionAcceptance === 'likeOnly'" v-tooltip="i18n.ts.likeOnly" class="ti ti-heart"></i>
			</span>
			<span v-if="note.localOnly" style="margin-right: 0.5em;"><i v-tooltip="i18n.ts._visibility['disableFederation']" class="ti ti-rocket-off"></i></span>
			<span :class="$style.renoteTime">
				<button ref="renoteTime" class="_button">
					<i class="ti ti-dots" :class="$style.renoteMenu" @mousedown.prevent="showRenoteMenu()"></i>
				</button>
				<MkTime :time="note.createdAt" :mode="prefer.s.enableAbsoluteTime ? 'absolute' : 'relative'"/>
			</span>
		</div>
	</div>
	<div v-if="isRenote && note.renote == null" :class="$style.deleted">
		{{ i18n.ts.deletedNote }}
	</div>
	<template v-else>
		<template v-if="appearNote.reply && appearNote.reply.replyId"><MkNoteSub v-for="note in conversation" :key="note.id" :class="[$style.replyToMore, { [$style.showReplyTargetNoteInSemiTransparent]: prefer.s.showReplyTargetNoteInSemiTransparent }]" :note="note"/></template>
		<MkNoteSub v-if="appearNote.replyId" :note="appearNote.reply ?? null" :class="[$style.replyTo, { [$style.showReplyTargetNoteInSemiTransparent]: prefer.s.showReplyTargetNoteInSemiTransparent }]"/>
		<article :class="$style.note" :style="{ paddingTop: prefer.s.showSubNoteFooterButton && appearNote.reply ? '14px' : '' }" @contextmenu.stop="onContextmenu">
			<header :class="$style.noteHeader">
				<MkAvatar v-if="!prefer.s.hideAvatarsInNote" :class="$style.noteHeaderAvatar" :user="appearNote.user" indicator link preview/>
				<div style="display: flex; align-items: center; white-space: nowrap; overflow: hidden;">
					<div :class="$style.noteHeaderBody">
						<div :class="$style.noteHeaderName">
							<MkA v-user-preview="appearNote.user.id" :class="$style.noteHeaderName" :to="userPage(appearNote.user)">
								<MkUserName :nowrap="true" :user="appearNote.user"/>
							</MkA>
							<span v-if="appearNote.user.isLocked" :class="$style.userBadge"><i class="ti ti-lock"></i></span>
							<span v-if="appearNote.user.isBot" :class="$style.userBadge"><i class="ti ti-robot"></i></span>
							<span v-if="appearNote.user.badgeRoles" :class="$style.badgeRoles">
								<img v-for="(role, i) in appearNote.user.badgeRoles" :key="i" v-tooltip="role.name" :class="$style.badgeRole" :src="role.iconUrl!"/>
							</span>
						</div>
						<div :class="$style.noteHeaderUsername"><MkAcct :user="appearNote.user"/></div>
					</div>
				</div>
				<div style="display: flex; align-items: flex-end; margin-left: auto;">
					<div :class="$style.noteHeaderBody">
						<div :class="$style.noteHeaderInfo">
							<span v-if="appearNote.updatedAt" style="margin-right: 0.5em;"><i v-tooltip="i18n.tsx.noteUpdatedAt({ date: (new Date(appearNote.updatedAt)).toLocaleDateString(), time: (new Date(appearNote.updatedAt)).toLocaleTimeString() })" class="ti ti-pencil"></i></span>
							<span v-if="appearNote.deleteAt" style="margin-right: 0.5em;"><i v-tooltip="`${i18n.ts.scheduledNoteDelete}: ${(new Date(appearNote.deleteAt)).toLocaleString()}`" class="ti ti-bomb"></i></span>
							<span v-if="appearNote.visibility !== 'public'" style="margin-left: 0.5em;">
								<i v-if="appearNote.visibility === 'home'" v-tooltip="i18n.ts._visibility[appearNote.visibility]" class="ti ti-home"></i>
								<i v-else-if="appearNote.visibility === 'followers'" v-tooltip="i18n.ts._visibility[appearNote.visibility]" class="ti ti-lock"></i>
								<i v-else-if="appearNote.visibility === 'specified'" ref="specified" v-tooltip="i18n.ts._visibility[appearNote.visibility]" class="ti ti-mail"></i>
							</span>
							<span v-if="appearNote.reactionAcceptance != null" style="margin-left: 0.5em;" :class="{ [$style.danger]: ['nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote', 'likeOnly'].includes(<string>appearNote.reactionAcceptance) }" :title="i18n.ts.reactionAcceptance">
								<i v-if="appearNote.reactionAcceptance === 'likeOnlyForRemote'" v-tooltip="i18n.ts.likeOnlyForRemote" class="ti ti-heart-plus"></i>
								<i v-else-if="appearNote.reactionAcceptance === 'nonSensitiveOnly'" v-tooltip="i18n.ts.nonSensitiveOnly" class="ti ti-icons"></i>
								<i v-else-if="appearNote.reactionAcceptance === 'nonSensitiveOnlyForLocalLikeOnlyForRemote'" v-tooltip="i18n.ts.nonSensitiveOnlyForLocalLikeOnlyForRemote" class="ti ti-heart-plus"></i>
								<i v-else-if="appearNote.reactionAcceptance === 'likeOnly'" v-tooltip="i18n.ts.likeOnly" class="ti ti-heart"></i>
							</span>
							<span v-if="appearNote.localOnly" style="margin-left: 0.5em;"><i v-tooltip="i18n.ts._visibility['disableFederation']" class="ti ti-rocket-off"></i></span>
						</div>
						<MkInstanceTicker v-if="showTicker" :host="appearNote.user.host" :instance="appearNote.user.instance" @click="showOnRemote"/>
					</div>
				<!--
				<div :class="$style.noteHeaderUsernameAndBadgeRoles">
					<div :class="$style.noteHeaderUsername">
						<MkAcct :user="appearNote.user"/>
					</div>
					<div v-if="appearNote.user.badgeRoles" :class="$style.noteHeaderBadgeRoles">
						<img v-for="(role, i) in appearNote.user.badgeRoles" :key="i" v-tooltip="role.name" :class="$style.noteHeaderBadgeRole" :src="role.iconUrl!"/>
					</div>
				</div>
				-->
				</div>
			</header>
			<div :class="$style.noteContent">
				<MkInfo v-if="appearNote.deleteAt != null" warn :class="$style.deleteAt">
					<I18n :src="i18n.ts.scheduledToDeleteOnX" tag="span">
						<template #x>
							<MkTime :time="appearNote.deleteAt" :mode="'detail'" style="font-weight: bold;"/>
						</template>
					</I18n>
				</MkInfo>
				<MkEvent v-if="appearNote.event" :note="appearNote"/>
				<p v-if="appearNote.cw != null" :class="$style.cw">
					<Mfm
						v-if="appearNote.cw != ''"
						style="margin-right: 8px;"
						:text="appearNote.cw"
						:author="appearNote.user"
						:nyaize="prefer.s.disableNyaize || noNyaize ? false : 'respect'"
						:enableEmojiMenu="!!$i"
						:enableEmojiMenuReaction="!!$i"
					/>
					<MkCwButton v-model="showContent" :text="appearNote.text" :renote="appearNote.renote" :files="appearNote.files" :poll="appearNote.poll" style="margin: 4px 0;"/>
				</p>
				<div v-show="appearNote.cw == null || showContent">
					<span v-if="appearNote.isHidden" style="opacity: 0.5">({{ i18n.ts._ffVisibility.private }})</span>
					<MkA v-if="appearNote.replyId" :class="$style.noteReplyTarget" :to="`/notes/${appearNote.replyId}`"><i class="ti ti-arrow-back-up"></i></MkA>
					<Mfm
						v-if="appearNote.text"
						:parsedNodes="parsed"
						:text="appearNote.text"
						:author="appearNote.user"
						:nyaize="prefer.s.disableNyaize || noNyaize ? false : 'respect'"
						:emojiUrls="appearNote.emojis"
						:enableEmojiMenu="!!$i"
						:enableEmojiMenuReaction="!!$i"
						class="_selectable"
						:enableAnimatedMfm="$i ? undefined : enableAnimatedMfm"
					/>
					<a v-if="appearNote.renote != null" :class="$style.rn">RN:</a>
					<div v-if="prefer.s.showTranslateButtonInNote && (!prefer.s.useAutoTranslate || (!$i?.policies.canUseAutoTranslate || (prefer.s.useAutoTranslate && (appearNote.cw != null || !showContent)))) && instance.translatorAvailable && $i && $i.policies.canUseTranslator && (appearNote.text || appearNote.poll) && isForeignLanguage" style="padding: 5px 0; color: var(--MI_THEME-accent);">
						<button v-if="translateStatus === 'none'" ref="translateButton" class="_button" @click="translate(false)">{{ i18n.ts.translateNote }}</button>
						<button v-else class="_button" @click="translateStatus = 'none'; translation = null">{{ i18n.ts.close }}</button>
					</div>
					<div v-if="translateStatus !== 'none'" :class="$style.translation">
						<MkLoading v-if="translateStatus === 'running'" mini/>
						<MkResult v-else-if="translateStatus === 'error'" type="error" :text="i18n.ts.translateError">
							<MkButton :class="$style.button" rounded @click.stop="() => translate(false)">{{ i18n.ts.retry }}</MkButton>
						</MkResult>
						<div v-else-if="translation">
							<b>{{ i18n.tsx.translatedFrom({ x: translation.sourceLang }) }}:</b><hr style="margin: 10px 0;">
							<Mfm
								v-if="appearNote.text"
								:text="translation.text"
								:author="appearNote.user"
								:nyaize="prefer.s.disableNyaize || noNyaize ? false : 'respect'"
								:emojiUrls="appearNote.emojis"
								:enableEmojiMenu="!!$i"
								:enableEmojiMenuReaction="!!$i"
								class="_selectable"
							/>
							<MkPoll
								v-if="appearNote.poll"
								:noteId="appearNote.id"
								:multiple="appearNote.poll.multiple"
								:expiresAt="appearNote.poll.expiresAt"
								:choices="$appearNote.pollChoices"
								:author="appearNote.user"
								:emojiUrls="appearNote.emojis"
								:class="$style.poll"
								isTranslation
							/>
							<div v-if="translation.translator == 'ctav3'" style="margin-top: 10px; padding: 0 0 15px;">
								<img v-if="!store.s.darkMode" src="/client-assets/color-short.svg" alt="" style="float: right;">
								<img v-else src="/client-assets/white-short.svg" alt="" style="float: right;"/>
							</div>
						</div>
					</div>
					<div v-if="viewTextSource">
						<hr style="margin: 10px 0;">
						<pre style="margin: initial; white-space: pre-wrap; word-wrap: break-word;"><small>{{ appearNote.text }}</small></pre>
						<button class="_button" style="padding: 5px 0; color: var(--MI_THEME-accent);" @click="viewTextSource = false"><small>{{ i18n.ts.close }}</small></button>
					</div>
					<div v-if="appearNote.files && appearNote.files.length > 0">
						<MkMediaList ref="galleryEl" :mediaList="appearNote.files"/>
					</div>
					<MkPoll
						v-if="appearNote.poll"
						:noteId="appearNote.id"
						:multiple="appearNote.poll.multiple"
						:expiresAt="appearNote.poll.expiresAt"
						:choices="$appearNote.pollChoices"
						:author="appearNote.user"
						:emojiUrls="appearNote.emojis"
						:class="$style.poll"
					/>
					<div v-if="isEnabledUrlPreview">
						<MkUrlPreview v-for="url in urls" :key="url" :url="url" :compact="true" :detail="true" :host="appearNote.user.host" style="margin-top: 6px;"/>
					</div>
					<div v-if="appearNote.renoteId" :class="$style.quote"><MkNoteSimple :note="appearNote?.renote ?? null" :class="$style.quoteNote"/></div>
				</div>
				<MkA v-if="appearNote.channel && !inChannel" :class="$style.channel" :to="`/channels/${appearNote.channel.id}`"><i class="ti ti-device-tv"></i> {{ appearNote.channel.name }}</MkA>
			</div>
			<div v-if="!$i && isAnimatedMfm" :class="$style.play_mfm_action">
				<MkSwitch v-model="enableAnimatedMfm">
					<template #label>{{ i18n.ts.enableAnimatedMfm }}</template>
				</MkSwitch>
			</div>
			<footer>
				<div :class="$style.noteFooterInfo">
					<div v-if="appearNote.updatedAt">
						{{ i18n.ts.edited }}: <MkTime :class="$style.time" :time="appearNote.updatedAt" mode="detail" colored/>
					</div>
					<MkA :to="notePage(appearNote)">
						<MkTime :class="$style.time" :time="appearNote.createdAt" mode="detail" colored/>
					</MkA>
					<span style="margin-left: 0.5em;">
						<span style="border: 1px solid var(--MI_THEME-divider); margin-right: 0.5em;"></span>
						<i v-if="appearNote.visibility === 'public'" class="ti ti-world"></i>
						<i v-else-if="appearNote.visibility === 'home'" class="ti ti-home"></i>
						<i v-else-if="appearNote.visibility === 'followers'" class="ti ti-lock"></i>
						<i v-else-if="appearNote.visibility === 'specified'" ref="specified" class="ti ti-mail"></i>
						<span style="margin-left: 0.3em;">{{ i18n.ts._visibility[appearNote.visibility] }}</span>
					</span>
				</div>
				<MkReactionsViewer
					v-if="appearNote.reactionAcceptance !== 'likeOnly'"
					style="margin-top: 6px;"
					:reactions="$appearNote.reactions"
					:reactionEmojis="$appearNote.reactionEmojis"
					:myReaction="$appearNote.myReaction"
					:noteId="appearNote.id"
					:note="appearNote"
					:maxNumber="16"
					@mockUpdateMyReaction="emitUpdReaction"
				/>
				<template v-if="prefer.s.showReplyButtonInNoteFooter">
					<button v-if="!note.isHidden" v-tooltip="i18n.ts.reply" class="_button" :class="$style.noteFooterButton" @click="reply()">
						<i class="ti ti-arrow-back-up"></i>
						<p v-if="appearNote.repliesCount > 0" :class="$style.noteFooterButtonCount">{{ Number(appearNote.repliesCount) }}</p>
					</button>
					<button v-else-if="note.isHidden" class="_button" :class="$style.noteFooterButton" disabled>
						<i class="ti ti-ban"></i>
					</button>
				</template>
				<template v-if="prefer.s.showRenoteButtonInNoteFooter">
					<button
						v-if="canRenote"
						ref="renoteButton"
						v-tooltip="i18n.ts.renote"
						class="_button"
						:class="$style.noteFooterButton"
						@click.stop="prefer.s.renoteQuoteButtonSeparation && ((!prefer.s.renoteVisibilitySelection && !appearNote.channel) || (appearNote.channel && !appearNote.channel.allowRenoteToExternal) || appearNote.visibility === 'followers') ? renoteOnly() : renote()"
					>
						<i class="ti ti-repeat"></i>
						<p v-if="appearNote.renoteCount > 0" :class="$style.noteFooterButtonCount">{{ Number(appearNote.renoteCount) }}</p>
					</button>
					<button v-else-if="!canRenote" class="_button" :class="$style.noteFooterButton" disabled>
						<i class="ti ti-ban"></i>
					</button>
				</template>
				<button v-if="appearNote.reactionAcceptance !== 'likeOnly' && $appearNote.myReaction == null && prefer.s.showLikeButtonInNoteFooter" ref="heartReactButton" v-tooltip="i18n.ts.like" :class="$style.noteFooterButton" class="_button" @click="heartReact()">
					<i class="ti ti-heart"></i>
				</button>
				<button v-if="prefer.s.showDoReactionButtonInNoteFooter" ref="reactButton" v-tooltip="appearNote.reactionAcceptance === 'likeOnly' && $appearNote.myReaction != null ? i18n.ts.unlike : $appearNote.myReaction != null ? i18n.ts.editReaction : appearNote.reactionAcceptance === 'likeOnly' ? i18n.ts.like : i18n.ts.doReaction" :class="$style.noteFooterButton" class="_button" @click.stop="toggleReact()">
					<i v-if="appearNote.reactionAcceptance === 'likeOnly' && $appearNote.myReaction != null" class="ti ti-heart-filled" style="color: var(--MI_THEME-love);"></i>
					<i v-else-if="$appearNote.myReaction != null" class="ti ti-mood-edit" style="color: var(--MI_THEME-accent);"></i>
					<i v-else-if="appearNote.reactionAcceptance === 'likeOnly'" class="ti ti-heart"></i>
					<i v-else class="ti ti-mood-plus"></i>
					<p v-if="(appearNote.reactionAcceptance === 'likeOnly' || prefer.s.showReactionsCount) && $appearNote.reactionCount > 0" :class="$style.noteFooterButtonCount">{{ Number($appearNote.reactionCount) }}</p>
				</button>
				<button v-if="canRenote && prefer.s.renoteQuoteButtonSeparation && prefer.s.showQuoteButtonInNoteFooter" ref="quoteButton" v-tooltip="i18n.ts.quote" class="_button" :class="$style.noteFooterButton" @click="quote()">
					<i class="ti ti-quote"></i>
				</button>
				<button v-if="prefer.s.showClipButtonInNoteFooter" ref="clipButton" v-tooltip="i18n.ts.clip" class="_button" :class="$style.noteFooterButton" @click="clip()">
					<i class="ti ti-paperclip"></i>
				</button>
				<button v-if="prefer.s.showMoreButtonInNoteFooter" ref="menuButton" v-tooltip="i18n.ts.more" class="_button" :class="$style.noteFooterButton" @click="showMenu()">
					<i class="ti ti-dots"></i>
				</button>
			</footer>
		</article>
		<div :class="$style.tabs">
			<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'replies' }]" @click="tab = 'replies'"><i class="ti ti-arrow-back-up"></i> {{ i18n.ts.replies }}</button>
			<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'renotes' }]" @click="tab = 'renotes'"><i class="ti ti-repeat"></i> {{ i18n.ts.renotes }}</button>
			<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'reactions' }]" @click="tab = 'reactions'"><i class="ti ti-icons"></i> {{ i18n.ts.reactions }}</button>
			<button v-if="appearNote.updatedAt" class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'history'}]" @click="tab = 'history'"> <i class="ti ti-history"></i> {{ i18n.ts.editHistory }} </button>
			<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'tag' }]" @click="tab = 'tag'"><i class="ti ti-hash"></i> {{ i18n.ts.hashtags }}</button>
		</div>
		<div>
			<div v-if="tab === 'replies'">
				<MkPostForm v-if="$i && !note.isHidden && !isMobile && prefer.s.showFixedPostFormInReplies" class="post-form _panel" fixed :reply="appearNote"></MkPostForm>
				<MkNoteSub v-for="note in replies" :key="note.id" :note="note" :class="$style.reply" :detail="true"/>
				<div v-if="replies.length > 2 && !repliesLoaded" style="padding: 16px">
					<MkButton style="margin: 0 auto;" primary rounded @click="loadReplies">{{ i18n.ts.loadMore }}</MkButton>
				</div>
			</div>
			<div v-else-if="tab === 'renotes'" :class="$style.tab_renotes">
				<MkPagination :paginator="renotesPaginator">
					<template #default="{ items }">
						<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); grid-gap: 12px;">
							<MkA v-for="item in items" :key="item.id" :to="userPage(item.user)">
								<MkUserCardMini :user="item.user" :withChart="false"/>
							</MkA>
						</div>
					</template>
				</MkPagination>
			</div>
			<div v-else-if="tab === 'reactions'" :class="$style.tab_reactions">
				<MkResult v-if="$appearNote.reactionCount === 0" type="empty"/>
				<div v-else>
					<div :class="$style.reactionTabs">
						<button v-for="reaction in Object.keys($appearNote.reactions)" :key="reaction" :class="[$style.reactionTab, { [$style.reactionTabActive]: reactionTabType === reaction }]" class="_button" @click="reactionTabType = reaction">
							<MkReactionIcon :reaction="reaction"/>
							<span style="margin-left: 4px;">{{ $appearNote.reactions[reaction] }}</span>
						</button>
					</div>
					<MkPagination v-if="reactionTabType" :key="reactionTabType" :paginator="reactionsPaginator">
						<template #default="{ items }">
							<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); grid-gap: 12px;">
								<MkA v-for="item in items" :key="item.id" :to="userPage(item.user)">
									<MkUserCardMini :user="item.user" :withChart="false"/>
								</MkA>
							</div>
						</template>
					</MkPagination>
				</div>
			</div>
			<div v-else-if="tab === 'history'">
				<div v-if="historiesLoading" style="padding: 16px; text-align: center;">
					<MkLoading/>
				</div>
				<template v-if="historiesLoadError">
					<MkError type="error" @retry="loadHistories"/>
				</template>
				<template v-else-if="historiesLoaded && histories.length == 0">
					<MkResult type="empty" :text="i18n.ts.noHistory"/>
				</template>
				<template v-else-if="historiesLoaded && histories.length > 0">
					<MkSwitch v-model="history_raw" style="padding: 16px;">{{ i18n.ts.compareContent }}</MkSwitch>
					<MkNoteHistory
						v-for="(history, index) in histories"
						:key="history.id"
						:oldNote="histories[index+1] ? histories[index+1] : null"
						:newNote="history"
						:originalNote="appearNote"
						:class="$style.reply"
						:detail="true"
						:raw="history_raw"
						:index="index"
					/>
					<div v-if="!history_list_end" style="padding: 16px">
						<MkButton style="margin: 0 auto;" primary rounded @click="loadHistories">{{ i18n.ts.loadMore }}</MkButton>
					</div>
				</template>
			</div>
			<div v-else-if="tab === 'tag'">
				<template v-if="appearNote.tags && appearNote.tags.length > 0">
					<div :class="$style.tags">
						<MkA v-for="tag in appearNote.tags" :key="'tag:' + tag" :to="`/tags/${tag}`">
							<div :class="$style.tag">
								<span>#{{ tag }}</span>
							</div>
						</MkA>
					</div>
				</template>
				<MkResult v-else type="empty" :text="i18n.ts.nothing"/>
			</div>
		</div>
	</template>
</div>
<div v-else-if="muted" class="_panel" :class="$style.muted" @click="muted = false">
	<I18n :src="i18n.ts.userSaysSomething" tag="small">
		<template #name>
			<MkA v-user-preview="appearNote.userId" :to="userPage(appearNote.user)">
				<MkUserName :user="appearNote.user"/>
			</MkA>
		</template>
	</I18n>
</div>
</template>

<script lang="ts" setup>
import { computed, inject, markRaw, provide, ref, useTemplateRef, watch } from 'vue';
import * as Misskey from 'misskey-js';
import { useNote } from '@/composables/use-note.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { userPage } from '@/filters/user.js';
import { notePage } from '@/filters/note.js';
import { isEnabledUrlPreview } from '@/utility/url-preview.js';
import { Paginator } from '@/utility/paginator.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { deviceKind } from '@/utility/device-kind.js';
import { store } from '@/store.js';
import { instance } from '@/instance.js';
import { DI } from '@/di.js';
import type { Keymap } from '@/utility/hotkey.js';

// コンポーネント外部の依存関係
import MkNoteSub from '@/components/MkNoteSub.vue';
import MkNoteSimple from '@/components/MkNoteSimple.vue';
import MkReactionsViewer from '@/components/MkReactionsViewer.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import MkCwButton from '@/components/MkCwButton.vue';
import MkPoll from '@/components/MkPoll.vue';
import MkUrlPreview from '@/components/MkUrlPreview.vue';
import MkInstanceTicker from '@/components/MkInstanceTicker.vue';
import MkEvent from '@/components/MkEvent.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkNoteHistory from '@/components/MkNoteHistory.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkUserCardMini from '@/components/MkUserCardMini.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkButton from '@/components/MkButton.vue';
import MkPostForm from '@/components/MkPostFormSimple.vue';

const MOBILE_THRESHOLD = 500;
const isMobile = ref(deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD);

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	initialTab?: string;
}>(), {
	initialTab: 'replies',
});

const emit = defineEmits<{
	(ev: 'reaction', emoji: string): void;
	(ev: 'removeReaction', emoji: string): void;
}>();

// 周辺コンテキストのインジェクト
const inChannel = inject(DI.inChannel, null);

// Template Refsの定義
const rootEl = useTemplateRef('rootEl');
const menuButton = useTemplateRef('menuButton');
const renoteButton = useTemplateRef('renoteButton');
const renoteTime = useTemplateRef('renoteTime');
const reactButton = useTemplateRef('reactButton');
const heartReactButton = useTemplateRef('heartReactButton');
const quoteButton = useTemplateRef('quoteButton');
const clipButton = useTemplateRef('clipButton');
const galleryEl = useTemplateRef('galleryEl');

// コンポーサブルの呼び出し
const {
	note,
	appearNote,
	$appearNote,
	hideByPlugin,
	isRenote,
	showContent,
	isDeleted,
	translateStatus,
	translation,
	viewTextSource,
	noNyaize,
	muted,
	canRenote,
	parsed,
	urls,
	showTicker,
	isAnimatedMfm,
	enableAnimatedMfm,
	isForeignLanguage,

	renote,
	renoteOnly,
	quote,
	reply,
	react,
	reactViaMfmEmoji,
	heartReact,
	translate,
	undoReact,
	onContextmenu,
	showMenu,
	clip,
	showRenoteMenu,
	blur,
} = useNote(props, {
	rootEl,
	menuButton,
	renoteButton,
	renoteTime,
	reactButton,
	heartReactButton,
	quoteButton,
	clipButton,
}, {
	inChannel,
});

// provide
provide(DI.mfmEmojiReactCallback, reactViaMfmEmoji);

// MkNoteDetailed固有
const tab = ref(props.initialTab);
const reactionTabType = ref<string | null>(null);

const renotesPaginator = markRaw(new Paginator('notes/renotes', {
	limit: 10,
	params: {
		noteId: appearNote.id,
	},
}));

const reactionsPaginator = markRaw(new Paginator('notes/reactions', {
	limit: 10,
	computedParams: computed(() => ({
		noteId: appearNote.id,
		type: reactionTabType.value,
	})),
}));

const replies = ref<Misskey.entities.Note[]>([]);
const repliesLoaded = ref(false);

function loadReplies() {
	repliesLoaded.value = true;
	misskeyApi('notes/children', {
		noteId: appearNote.id,
		limit: 30,
	}).then(res => {
		replies.value = res;
	});
}

function loadRepliesSimple() {
	misskeyApi('notes/children', {
		noteId: appearNote.id,
		limit: 3,
	}).then(res => {
		replies.value = res;
	});
}

if (tab.value === 'replies' && !repliesLoaded.value) {
	if (appearNote.repliesCount <= 3 || !prefer.s.autoLoadMoreReplies) loadRepliesSimple();
	else if (appearNote.repliesCount > 3 && prefer.s.autoLoadMoreReplies) loadReplies();
}

const conversation = ref<Misskey.entities.Note[]>([]);
const conversationLoaded = ref(false);

function loadConversation() {
	conversationLoaded.value = true;
	if (appearNote.replyId == null) return;
	misskeyApi('notes/conversation', {
		noteId: appearNote.replyId,
	}).then(res => {
		conversation.value = res.reverse();
	});
}

if (appearNote.reply && appearNote.reply.replyId && prefer.s.autoLoadMoreConversation) loadConversation();

function showOnRemote() {
	if (props.note.user.instance !== undefined) window.open(props.note.url ?? props.note.uri, '_blank', 'noopener');
}

const histories = ref<Misskey.entities.NoteHistory[]>([]);
const historiesLoading = ref(false);
const historiesLoaded = ref(false);
const historiesLoadError = ref(false);
const histories_untilId = ref<Misskey.entities.NoteHistory['id']>();
const history_list_end = ref(false);
const history_raw = ref(false);

async function loadHistories() {
	if (historiesLoading.value) return;
	historiesLoading.value = true;
	historiesLoadError.value = false;

	misskeyApi('notes/history', {
		...(histories_untilId.value ? { untilId: histories_untilId.value } : {} ),
		noteId: appearNote.id,
		limit: 5,
	}).then(res => {
		if (res.length > 0) {
			if (histories.value.length === 0) {
				const current_version: Misskey.entities.NoteHistory = {
					id: appearNote.id,
					noteId: appearNote.id,
					createdAt: appearNote.createdAt,
					updatedAt: appearNote.createdAt,
					userId: appearNote.userId,
					text: appearNote.text,
					cw: appearNote.cw,
					poll: appearNote.poll ? {
						choices: appearNote.poll.choices.map(c => c.text),
						multiple: appearNote.poll.multiple,
						expiresAt: appearNote.poll.expiresAt ?? null,
					} : null,
					event: appearNote.event ? {
						title: appearNote.event.title,
						start: appearNote.event.start,
						end: appearNote.event.end,
						metadata: appearNote.event.metadata,
					} : null,
					fileIds: appearNote.fileIds,
					files: appearNote.files,
					visibility: appearNote.visibility,
					visibleUserIds: appearNote.visibleUserIds,
					emojis: appearNote.emojis,
				};
				histories.value.push(current_version);
			}
			histories_untilId.value = res[res.length - 1].id;
			histories.value = histories.value.concat(res);
		}
		if (res.length < 5) {
			history_list_end.value = true;
		}
	}).catch(() => {
		historiesLoadError.value = true;
	}).finally(() => {
		historiesLoaded.value = true;
		historiesLoading.value = false;
	});
}

watch(() => tab.value, async (newTab) => {
	if (newTab === 'history' && !historiesLoaded.value) {
		await loadHistories();
	}
});

function toggleReact() {
	if (appearNote.myReaction == null) {
		react();
	} else {
		undoReact();
	}
}

// キーボードショートカットマップ
const keymap = {
	'r': () => reply(),
	'e|a|plus': () => react(),
	'q': () => renote(),
	'm': () => showMenu(),
	'c': () => {
		if (!prefer.s.showClipButtonInNoteFooter) return;
		clip();
	},
	'o': () => {
		galleryEl.value?.openGallery();
	},
	'v|enter': () => {
		if (appearNote.cw != null) {
			showContent.value = !showContent.value;
		}
	},
	'esc': {
		allowRepeat: true,
		callback: () => blur(),
	},
} as const satisfies Keymap;

function emitUpdReaction(emoji: string, delta: number) {
	if (delta < 0) {
		emit('removeReaction', emoji);
	} else if (delta > 0) {
		emit('reaction', emoji);
	}
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	transition: box-shadow 0.1s ease;
	overflow: clip;
	contain: content;

	&:focus-visible {
		outline: none;

		&::after {
			content: "";
			pointer-events: none;
			display: block;
			position: absolute;
			z-index: 10;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			margin: auto;
			width: calc(100% - 8px);
			height: calc(100% - 8px);
			border: dashed 2px var(--MI_THEME-focus);
			border-radius: var(--MI-radius);
			box-sizing: border-box;
		}
	}
}

.replyTo {
	padding-bottom: 0;

	&.showReplyTargetNoteInSemiTransparent {
		opacity: 0.7;
	}
}

.replyToMore {
	&.showReplyTargetNoteInSemiTransparent {
		opacity: 0.7;
	}
}

.renote {
	display: flex;
	align-items: center;
	padding: 16px 32px 8px 32px;
	line-height: 28px;
	white-space: pre;
	color: var(--MI_THEME-renote);
}

.renoteAvatar {
	flex-shrink: 0;
	display: inline-block;
	width: 28px;
	height: 28px;
	margin: 0 8px 0 0;
	border-radius: 6px;
	background: var(--MI_THEME-panel);
}

.renoteText {
	overflow: hidden;
	flex-shrink: 1;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.renoteName {
	font-weight: bold;
	text-decoration: none;

	&:hover {
		color: var(--MI_THEME-renoteHover);
		text-decoration: none;
	}
}

.renoteInfo {
	margin-left: auto;
	font-size: 0.9em;
}

.renoteTime {
	flex-shrink: 0;
	color: inherit;
}

.renoteMenu {
  margin-right: 4px;
}

.renote + .note {
	padding-top: 8px;
}

.note {
	padding: 32px;
	font-size: 1.2em;

	&:hover > .main > .footer > .button {
		opacity: 1;
	}
}

.noteHeader {
	display: flex;
	position: relative;
	margin-bottom: 16px;
	align-items: center;
}

.noteHeaderAvatar {
	display: block;
	flex-shrink: 0;
	width: 58px;
	height: 58px;
	background: var(--MI_THEME-panel);
}

.noteHeaderBody {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding-left: 16px;
	font-size: 0.95em;
  max-width: 300px;
}

.noteHeaderName {
	display: flex;
	font-weight: bold;
	line-height: 1.3;
	margin: 0 .5em 0 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
  white-space: nowrap;

  &::-webkit-scrollbar {
    display: none;
  }

	&:hover {
		color: var(--MI_THEME-nameHover);
		text-decoration: none;
	}
}

.userBadge {
	margin: 0 .5em 0 0;
}

.isBot {
	display: inline-block;
	margin: 0 0.5em;
	padding: 4px 6px;
	font-size: 80%;
	line-height: 1;
	border: solid 0.5px var(--MI_THEME-divider);
	border-radius: 4px;
}

.noteHeaderInfo {
	float: right;
	text-align: right;
}

.noteHeaderUsernameAndBadgeRoles {
	display: flex;
}

.noteHeaderUsername {
	margin-bottom: 2px;
	margin-right: 0.5em;
	line-height: 1.3;
	word-wrap: anywhere;
  overflow: hidden;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
  white-space: nowrap;

  &::-webkit-scrollbar {
    display: none;
  }
}

.noteHeaderBadgeRoles {
	margin: 0 .5em 0 0;
}

.noteHeaderBadgeRole {
	height: 1.3em;
	vertical-align: -20%;
	border-radius: 0.4em;

	& + .noteHeaderBadgeRole {
		margin-left: 0.2em;
	}
}

.noteContent {
	container-type: inline-size;
	overflow-wrap: break-word;
	z-index: 2;
	position: relative;
}

.cw {
	cursor: default;
	display: block;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.noteReplyTarget {
	color: var(--MI_THEME-accent);
	margin-right: 0.5em;
}

.rn {
	margin-left: 4px;
	font-style: oblique;
	color: var(--MI_THEME-renote);
}

.translation {
	border: solid 0.5px var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	padding: 12px;
	margin-bottom: 8px;
}

.poll {
	font-size: 80%;
}

.quote {
	padding: 16px 0;
}

.quoteNote {
	padding: 24px !important;
	border: solid 1px var(--MI_THEME-renote);
	border-radius: 8px;
	overflow: clip;
}

.channel {
	opacity: 0.7;
	font-size: 80%;
}

.noteFooterInfo {
	margin: 16px 0;
	opacity: 0.7;
	font-size: 0.9em;
}

.noteFooterButton {
	margin: 0;
	padding: 8px;
	opacity: 0.7;

	&:not(:last-child) {
		margin-right: 10px;
	}

	&:hover {
		color: var(--MI_THEME-fgHighlighted);
	}
}

.noteFooterButtonCount {
	display: inline;
	margin: 0 0 0 8px;
	opacity: 0.7;

	&.reacted {
		color: var(--MI_THEME-accent);
	}
}

.reply:not(:first-child) {
	border-top: solid 0.5px var(--MI_THEME-divider);
}

.tabs {
	border-top: solid 0.5px var(--MI_THEME-divider);
	border-bottom: solid 0.5px var(--MI_THEME-divider);
	display: flex;
}

.tab {
	flex: 1;
	padding: 12px 8px;
	border-top: solid 2px transparent;
	border-bottom: solid 2px transparent;
}

.tabActive {
	border-bottom: solid 2px var(--MI_THEME-accent);
}

.tab_renotes {
	padding: 16px;
}

.tab_reactions {
	padding: 16px;
}

.tab_history {
	padding: 16px;
}
.reactionTabs {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	margin-bottom: 8px;
}

.reactionTab {
	padding: 0 12px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 999px;
	height: 30px;
}

.reactionTabActive {
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
	box-shadow: 0 0 0 1px var(--MI_THEME-accent) inset;
}

.time {
	text-decoration: none;

	&:hover {
		text-decoration: none;
	}
}

.danger {
	color: var(--MI_THEME-accent);
}

@container (max-width: 500px) {
	.root {
		font-size: 0.9em;
	}

  .noteHeaderBody {
    max-width: 180px;
  }
}

@container (max-width: 480px) {
	.renote {
		padding: 8px 16px 0 16px;
	}

	.note {
		padding: 22px 24px;
	}

	.noteHeaderAvatar {
		width: 50px;
		height: 50px;
	}
}

@container (max-width: 300px) {
	.root {
		font-size: 0.825em;
	}

	.noteHeaderAvatar {
		width: 50px;
		height: 50px;
	}
}

.historyRoot {
	display: flex;
	margin: 0;
	padding: 10px;
	overflow: clip;
	font-size: 0.95em;
}

.historyMain {
	flex: 1;
	min-width: 0;
}

.historyHeader {
	display: flex;
	margin-bottom: 2px;
	font-weight: bold;
	width: 100%;
	overflow: clip;
	text-overflow: ellipsis;
}
.avatar {
	flex-shrink: 0 !important;
	display: block !important;
	margin: 0 10px 0 0 !important;
	width: 40px !important;
	height: 40px !important;
	border-radius: 8px !important;
	pointer-events: none !important;
}

.updatedAt {
	flex-shrink: 0;
	margin-left: auto;
	font-size: 0.9em;
}

.muted {
	padding: 8px;
	text-align: center;
	opacity: 0.7;
}

.deleted {
	text-align: center;
	padding: 32px;
	margin: 6px 32px 32px;
	--color: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.15));
	background-size: auto auto;
	background-image: repeating-linear-gradient(135deg, transparent, transparent 10px, var(--color) 4px, var(--color) 14px);
	border-radius: 8px;
}

.badgeRoles {
	margin: 0 .5em 0 0;
}

.badgeRole {
	height: 1.3em;
	vertical-align: -20%;
	border-radius: 0.4em;

	& + .badgeRole {
		margin-left: 0.2em;
	}
}

.deleteAt {
	margin: 0 0 8px 0;
}

.play_mfm_action {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
	margin-top: 6px;
}

.tags {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	grid-gap: 12px;
	padding: 16px;
}

.tag {
	display: flex;
	align-items: center;
	padding: 16px;
	background: var(--MI_THEME-buttonBg);
	border-radius: 6px;
	cursor: pointer;
}

.button {
	margin: 0 auto;
}
</style>
