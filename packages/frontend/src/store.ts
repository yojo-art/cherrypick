/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import { prefersReducedMotion } from '@@/js/config.js';
import { hemisphere } from '@@/js/intl-const.js';
import type { DeviceKind } from '@/utility/device-kind.js';
import type { TIPS } from '@/tips.js';
import { Pizzax } from '@/lib/pizzax.js';
import { DEFAULT_DEVICE_KIND } from '@/utility/device-kind.js';

/**
 * 「状態」を管理するストア(not「設定」)
 */
export const store = markRaw(new Pizzax('base', {
	accountSetupWizard: {
		where: 'account',
		default: 0,
	},
	tips: {
		where: 'device',
		default: {} as Partial<Record<typeof TIPS[number], boolean>>, // true = 既読
	},
	memo: {
		where: 'account',
		default: null as string | null,
	},
	reactionAcceptance: {
		where: 'account',
		default: null as 'likeOnly' | 'likeOnlyForRemote' | 'nonSensitiveOnly' | 'nonSensitiveOnlyForLocalLikeOnlyForRemote' | null,
	},
	mutedAds: {
		where: 'account',
		default: [] as string[],
	},
	visibility: {
		where: 'deviceAccount',
		default: 'public' as (typeof Misskey.noteVisibilities)[number],
	},
	rememberNoteSearchbility: {
		where: 'account',
		default: false,
	},
	searchbility: {
		where: 'deviceAccount',
		default: 'public' as (typeof Misskey.noteSearchbility)[number],
	},
	defaultNoteSearchbility: {
		where: 'account',
		default: 'public' as (typeof Misskey.noteSearchbility)[number],
	},
	tl: {
		where: 'deviceAccount',
		default: {
			src: 'home' as 'home' | 'local' | 'social' | 'global' | 'media' | 'bubble' | `list:${string}`,
			userList: null as Misskey.entities.UserList | null,
			filter: {
				withReplies: false,
				withRenotes: true,
				withSensitive: true,
				onlyFiles: false,
				onlyCats: false,
				withBots: true,
			},
		},
	},
	darkMode: {
		where: 'device',
		default: false,
	},
	realtimeMode: {
		where: 'device',
		default: true,
	},
	recentlyUsedEmojis: {
		where: 'device',
		default: [] as string[],
	},
	recentlyUsedUsers: {
		where: 'device',
		default: [] as string[],
	},
	menuDisplay: {
		where: 'device',
		default: 'sideFull' as 'sideFull' | 'sideIcon'/* | 'top' */,
	},
	postFormWithHashtags: {
		where: 'device',
		default: false,
	},
	postFormHashtags: {
		where: 'device',
		default: '',
	},
	additionalUnicodeEmojiIndexes: {
		where: 'device',
		default: {} as Record<string, Record<string, string[]>>,
	},
	pluginTokens: {
		where: 'deviceAccount',
		default: {} as Record<string, string>, // plugin id, token
	},
	accountTokens: {
		where: 'device',
		default: {} as Record<string, string>, // host/userId, token
	},
	accountInfos: {
		where: 'device',
		default: {} as Record<string, Misskey.entities.MeDetailed>, // host/userId, user
	},

	enablePreferencesAutoCloudBackup: {
		where: 'device',
		default: false,
	},
	showPreferencesAutoCloudBackupSuggestion: {
		where: 'device',
		default: true,
	},
	showStoragePersistenceSuggestion: {
		where: 'device',
		default: true,
	},

	//#region TODO: そのうち消す (preferに移行済み)
	defaultWithReplies: {
		where: 'account',
		default: true,
	},
	reactions: {
		where: 'account',
		default: ['👍', '❤️', '😆', '🤔', '😮', '🎉', '💢', '😥', '😇', '🍮'],
	},
	pinnedEmojis: {
		where: 'account',
		default: [],
	},
	widgets: {
		where: 'account',
		default: [] as {
			name: string;
			id: string;
			place: string | null;
			data: Record<string, any>;
		}[],
	},
	overridedDeviceKind: {
		where: 'device',
		default: null as DeviceKind | null,
	},
	defaultSideView: {
		where: 'device',
		default: false,
	},
	defaultNoteVisibility: {
		where: 'account',
		default: 'public' as (typeof Misskey.noteVisibilities)[number],
	},
	defaultNoteLocalOnly: {
		where: 'account',
		default: false,
	},
	keepCw: {
		where: 'account',
		default: true,
	},
	collapseRenotes: {
		where: 'account',
		default: true,
	},
	rememberNoteVisibility: {
		where: 'account',
		default: false,
	},
	uploadFolder: {
		where: 'account',
		default: null as string | null,
	},
	keepOriginalUploading: {
		where: 'account',
		default: false,
	},
	menu: {
		where: 'deviceAccount',
		default: [
			'notifications',
			'clips',
			'drive',
			'followRequests',
			'-',
			'official_tags',
			'explore',
			'announcements',
			'search',
			'-',
			'ui',
		],
	},
	statusbars: {
		where: 'deviceAccount',
		default: [] as {
			name: string;
			id: string;
			type: string;
			size: 'verySmall' | 'small' | 'medium' | 'large' | 'veryLarge';
			black: boolean;
			props: Record<string, any>;
		}[],
	},
	pinnedUserLists: {
		where: 'deviceAccount',
		default: [] as Misskey.entities.UserList[],
	},
	serverDisconnectedBehavior: {
		where: 'device',
		default: 'quiet' as 'quiet' | 'reload' | 'dialog' | 'none',
	},
	nsfw: {
		where: 'device',
		default: 'respect' as 'respect' | 'force' | 'ignore',
	},
	highlightSensitiveMedia: {
		where: 'device',
		default: false,
	},
	animation: {
		where: 'device',
		default: !prefersReducedMotion,
	},
	animatedMfm: {
		where: 'device',
		default: !prefersReducedMotion,
	},
	advancedMfm: {
		where: 'device',
		default: true,
	},
	showReactionsCount: {
		where: 'device',
		default: true,
	},
	enableQuickAddMfmFunction: {
		where: 'device',
		default: true,
	},
	loadRawImages: {
		where: 'device',
		default: false,
	},
	imageNewTab: {
		where: 'device',
		default: false,
	},
	disableShowingAnimatedImages: {
		where: 'device',
		default: prefersReducedMotion,
	},
	emojiStyle: {
		where: 'device',
		default: 'twemoji' as 'twemoji' | 'fluentEmoji' | 'native',
	},
	menuStyle: {
		where: 'device',
		default: 'auto' as 'auto' | 'popup' | 'drawer',
	},
	useBlurEffectForModal: {
		where: 'device',
		default: DEFAULT_DEVICE_KIND === 'desktop',
	},
	useBlurEffect: {
		where: 'device',
		default: DEFAULT_DEVICE_KIND === 'desktop',
	},
	showFixedPostForm: {
		where: 'device',
		default: false,
	},
	showFixedPostFormInChannel: {
		where: 'device',
		default: false,
	},
	enableInfiniteScroll: {
		where: 'device',
		default: true,
	},
	useReactionPickerForContextMenu: {
		where: 'device',
		default: false,
	},
	showGapBetweenNotesInTimeline: {
		where: 'device',
		default: true,
	},
	instanceTicker: {
		where: 'device',
		default: 'remote' as 'always' | 'remote' | 'none',
	},
	emojiPickerScale: {
		where: 'device',
		default: 3,
	},
	emojiPickerWidth: {
		where: 'device',
		default: 2,
	},
	emojiPickerHeight: {
		where: 'device',
		default: 3,
	},
	emojiPickerStyle: {
		where: 'device',
		default: 'auto' as 'auto' | 'popup' | 'drawer',
	},
	reportError: {
		where: 'device',
		default: false,
	},
	squareAvatars: {
		where: 'account',
		default: true,
	},
	showAvatarDecorations: {
		where: 'device',
		default: true,
	},
	numberOfPageCache: {
		where: 'device',
		default: 3,
	},
	showNoteActionsOnlyHover: {
		where: 'device',
		default: false,
	},
	showClipButtonInNoteFooter: {
		where: 'device',
		default: false,
	},
	reactionsDisplaySize: {
		where: 'device',
		default: 'small' as 'small' | 'medium' | 'large',
	},
	limitWidthOfReaction: {
		where: 'device',
		default: true,
	},
	forceShowAds: {
		where: 'device',
		default: true,
	},
	aiChanMode: {
		where: 'device',
		default: false,
	},
	devMode: {
		where: 'device',
		default: false,
	},
	mediaListWithOneImageAppearance: {
		where: 'device',
		default: 'expand' as 'expand' | '16_9' | '1_1' | '2_3',
	},
	notificationPosition: {
		where: 'device',
		default: 'rightBottom' as 'leftTop' | 'leftBottom' | 'rightTop' | 'rightBottom',
	},
	notificationStackAxis: {
		where: 'device',
		default: 'vertical' as 'vertical' | 'horizontal',
	},
	enableCondensedLine: {
		where: 'device',
		default: false,
	},
	keepScreenOn: {
		where: 'device',
		default: false,
	},
	useGroupedNotifications: {
		where: 'device',
		default: true,
	},
	useGroupedNoteNotifications: {
		where: 'device',
		default: false,
	},
	dataSaver: {
		where: 'device',
		default: {
			media: false,
			avatar: false,
			urlPreview: false,
			code: false,
		},
	},
	enableSeasonalScreenEffect: {
		where: 'device',
		default: false,
	},
	enableHorizontalSwipe: {
		where: 'device',
		default: true,
	},
	useNativeUIForVideoAudioPlayer: {
		where: 'device',
		default: false,
	},
	keepOriginalFilename: {
		where: 'device',
		default: true,
	},
	alwaysConfirmFollow: {
		where: 'device',
		default: true,
	},
	confirmWhenRevealingSensitiveMedia: {
		where: 'device',
		default: false,
	},
	contextMenu: {
		where: 'device',
		default: 'app' as 'app' | 'appWithShift' | 'native',
	},
	skipNoteRender: {
		where: 'device',
		default: true,
	},
	showSoftWordMutedWord: {
		where: 'device',
		default: false,
	},
	confirmOnReact: {
		where: 'device',
		default: false,
	},
	hemisphere: {
		where: 'device',
		default: hemisphere as 'N' | 'S',
	},

	sound_masterVolume: {
		where: 'device',
		default: 0.3,
	},
	sound_notUseSound: {
		where: 'device',
		default: false,
	},
	sound_useSoundOnlyWhenActive: {
		where: 'device',
		default: false,
	},
	sound_note: {
		where: 'device',
		default: { type: 'syuilo/n-aec', volume: 1 },
	},
	sound_noteMy: {
		where: 'device',
		default: { type: 'syuilo/n-cea-4va', volume: 1 },
	},
	sound_noteSchedulePost: {
		where: 'device',
		default: { type: 'syuilo/n-cea', volume: 1 },
	},
	sound_noteEdited: {
		where: 'device',
		default: { type: 'syuilo/n-eca', volume: 1 },
	},
	sound_notification: {
		where: 'device',
		default: { type: 'syuilo/n-ea', volume: 1 },
	},
	sound_reaction: {
		where: 'device',
		default: { type: 'syuilo/bubble2', volume: 1 },
	},
	sound_chat: {
		where: 'device',
		default: { type: 'syuilo/waon', volume: 1 },
	},
	dropAndFusion: {
		where: 'device',
		default: {
			bgmVolume: 0.25,
			sfxVolume: 1,
		},
	},

	// #region CherryPick
	// - Settings/Appearance
	fontSize: {
		where: 'device',
		default: 8,
	},
	showUnreadNotificationsCount: {
		where: 'deviceAccount',
		default: false,
	},
	setFederationAvatarShape: {
		where: 'account',
		default: true,
	},
	filesGridLayoutInUserPage: {
		where: 'device',
		default: true,
	},

	// - Settings/Timeline and Note
	forceCollapseAllRenotes: {
		where: 'account',
		default: false,
	},
	collapseReplies: {
		where: 'account',
		default: false,
	},
	collapseLongNoteContent: {
		where: 'account',
		default: true,
	},
	collapseDefault: {
		where: 'account',
		default: true,
	},
	allMediaNoteCollapse: {
		where: 'device',
		default: false,
	},
	showSubNoteFooterButton: {
		where: 'device',
		default: true,
	},
	infoButtonForNoteActionsEnabled: {
		where: 'account',
		default: true,
	},
	showTranslateButtonInNote: {
		where: 'device',
		default: true,
	},
	showGapBodyOfTheNote: {
		where: 'device',
		default: false,
	},
	showReplyButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showRenoteButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showLikeButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showDoReactionButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showQuoteButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showMoreButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	selectReaction: {
		where: 'device',
		default: '❤️' as string,
	},
	showReplyInNotification: {
		where: 'device',
		default: false,
	},
	renoteQuoteButtonSeparation: {
		where: 'device',
		default: true,
	},
	renoteVisibilitySelection: {
		where: 'device',
		default: true,
	},
	gridLayoutMediaTimeline: {
		where: 'device',
		default: true,
	},
	forceRenoteVisibilitySelection: {
		where: 'device',
		default: 'none' as 'none' | 'public' | 'home' | 'followers',
	},
	showFixedPostFormInReplies: {
		where: 'device',
		default: true,
	},
	showNoAltTextWarning: {
		where: 'device',
		default: false,
	},
	alwaysShowCw: {
		where: 'device',
		default: false,
	},
	hideAvatarsInNote: {
		where: 'device',
		default: false,
	},
	enableAbsoluteTime: {
		where: 'device',
		default: false,
	},
	enableMarkByDate: {
		where: 'device',
		default: false,
	},
	showReplyTargetNote: {
		where: 'device',
		default: true,
	},
	showReplyTargetNoteInSemiTransparent: {
		where: 'device',
		default: true,
	},
	nsfwOpenBehavior: {
		where: 'device',
		default: 'click' as 'click' | 'doubleClick',
	},

	// - Settings/Posting form
	showPreview: {
		where: 'device',
		default: false,
	},
	showProfilePreview: {
		where: 'device',
		default: true,
	},
	checkMultipleRenote: {
		where: 'device',
		default: false,
	},
	checkReactionDialog: {
		where: 'device',
		default: false,
	},
	hideTagUiTags: {
		where: 'device',
		default: true,
	},

	// - Settings/Navigate to an external site warning
	externalNavigationWarning: {
		where: 'device',
		default: true,
	},
	trustedDomains: {
		where: 'device',
		default: [] as string[],
	},

	// - Settings/Accessibility
	showingAnimatedImages: {
		where: 'device',
		default: /mobile|ipad|iphone|android/.test(navigator.userAgent.toLowerCase()) ? 'inactive' : 'always' as 'always' | 'interaction' | 'inactive',
	},

	// - Settings/Performance
	removeModalBgColorForBlur: {
		where: 'device',
		default: DEFAULT_DEVICE_KIND === 'desktop',
	},
	smoothTransitionAnimations: {
		where: 'device',
		default: false,
	},

	// - Settings/Other
	autoLoadMoreReplies: {
		where: 'device',
		default: false,
	},
	autoLoadMoreConversation: {
		where: 'device',
		default: false,
	},
	useAutoTranslate: {
		where: 'device',
		default: false,
	},
	welcomeBackToast: {
		where: 'device',
		default: true,
	},
	disableNyaize: {
		where: 'device',
		default: false,
	},
	requireRefreshBehavior: {
		where: 'device',
		default: 'dialog' as 'quiet' | 'dialog',
	},
	newNoteReceivedNotificationBehavior: {
		where: 'device',
		default: 'count' as 'default' | 'count' | 'none',
	},
	searchEngine: {
		where: 'device',
		default: 'google' as 'google' | 'bing' | 'yahoo' | 'baidu' | 'naver' | 'daum' | 'duckduckgo' | 'other',
	},
	searchEngineUrl: {
		where: 'device',
		default: 'https://www.ecosia.org/search?',
	},
	searchEngineUrlQuery: {
		where: 'device',
		default: 'q',
	},

	// - Settings/Navigation bar
	bannerDisplay: {
		where: 'device',
		default: 'topBottom' as 'all' | 'topBottom' | 'top' | 'bottom' | 'bg' | 'hide',
	},
	showMenuButtonInNavbar: {
		where: 'device',
		default: true,
	},
	showHomeButtonInNavbar: {
		where: 'device',
		default: true,
	},
	showExploreButtonInNavbar: {
		where: 'device',
		default: false,
	},
	showSearchButtonInNavbar: {
		where: 'device',
		default: false,
	},
	showNotificationButtonInNavbar: {
		where: 'device',
		default: true,
	},
	showChatButtonInNavbar: {
		where: 'device',
		default: false,
	},
	showWidgetButtonInNavbar: {
		where: 'device',
		default: true,
	},
	showPostButtonInNavbar: {
		where: 'device',
		default: true,
	},

	// - Settings/Timeline
	enableHomeTimeline: {
		where: 'device',
		default: true,
	},
	enableLocalTimeline: {
		where: 'device',
		default: true,
	},
	enableSocialTimeline: {
		where: 'device',
		default: true,
	},
	enableGlobalTimeline: {
		where: 'device',
		default: true,
	},
	enableMediaTimeline: {
		where: 'device',
		default: true,
	},
	enableBubbleTimeline: {
		where: 'device',
		default: true,
	},
	enableListTimeline: {
		where: 'device',
		default: true,
	},
	enableAntennaTimeline: {
		where: 'device',
		default: true,
	},
	enableChannelTimeline: {
		where: 'device',
		default: true,
	},
	enableTagTimeline: {
		where: 'device',
		default: true,
	},

	// - Settings/CherryPick
	nicknameEnabled: {
		where: 'account',
		default: true,
	},
	nicknameMap: {
		where: 'account',
		default: {} as Record<string, string>,
	},
	useEnterToSend: {
		where: 'device',
		default: false,
	},
	postFormVisibilityHotkey: {
		where: 'device',
		default: true,
	},
	showRenoteConfirmPopup: {
		where: 'device',
		default: true,
	},
	expandOnNoteClick: {
		where: 'device',
		default: true,
	},
	expandOnNoteClickBehavior: {
		where: 'device',
		default: 'click' as 'click' | 'doubleClick',
	},
	reactableRemoteReactionEnabled: {
		where: 'account',
		default: true,
	},
	showFollowingMessageInsteadOfButtonEnabled: {
		where: 'account',
		default: true,
	},
	renameTheButtonInPostFormToNya: {
		where: 'account',
		default: false,
	},
	renameTheButtonInPostFormToNyaManualSet: {
		where: 'account',
		default: false,
	},
	enableWidgetsArea: {
		where: 'device',
		default: true,
	},
	// #endregion
}));

// TODO: 他のタブと永続化されたstateを同期

const PREFIX = 'miux:' as const;

interface Watcher {
	key: string;
	callback: (value: unknown) => void;
}
