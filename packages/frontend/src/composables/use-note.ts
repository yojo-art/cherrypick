/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref, watch, computed } from 'vue';
import * as Misskey from 'misskey-js';
import { isLink } from '@@/js/is-link.js';
import { shouldCollapsed, shouldMfmCollapsed, shouldAnimatedMfm } from '@@/js/collapsed.js';
import { host } from '@@/js/config.js';
import { toUnicode } from 'punycode.js';
import type { Ref } from 'vue';
import type { OpenOnRemoteOptions } from '@/utility/please-login.js';
import type { TranslateStatus } from '@/utility/translate.js';
import type { DI as DIType } from '@/di.js';
import type { ExtractInjectedType } from '@/types/misc.js';
import type { MenuItem } from '@/types/menu.js';
import type { WordMuteResult } from '@/utility/check-word-mute.js';
import { pleaseLogin } from '@/utility/please-login.js';
import { checkWordMute } from '@/utility/check-word-mute.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import * as sound from '@/utility/sound.js';
import * as os from '@/os.js';
import { reactionPicker } from '@/utility/reaction-picker.js';
import { extractUrlFromMfm } from '@/utility/extract-url-from-mfm.js';
import { parseMfmCached } from '@/utility/mfm-cache.js';
import { getNoteClipMenu, getNoteMenu, getRenoteMenu, getRenoteOnly, getQuoteMenu, getAbuseNoteMenu, getCopyNoteLinkMenu } from '@/utility/get-note-menu.js';
import { noteEvents, useNoteCapture } from '@/composables/use-note-capture.js';
import { deepClone } from '@/utility/clone.js';
import { useTooltip } from '@/composables/use-tooltip.js';
import { claimAchievement } from '@/utility/achievements.js';
import { showMovedDialog } from '@/utility/show-moved-dialog.js';
import { getAppearNote } from '@/utility/get-appear-note.js';
import { prefer } from '@/preferences.js';
import { getPluginHandlers } from '@/plugin.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { globalEvents, useGlobalEvent } from '@/events.js';
import { instance } from '@/instance.js';
import { miLocalStorage } from '@/local-storage.js';
import { useRouter } from '@/router.js';
import { haptic } from '@/utility/haptic.js';
import detectLanguage from '@/utility/detect-language.js';
import { notesReactionsCreate } from '@/utility/check-reaction-create';
import MkUsersTooltip from '@/components/MkUsersTooltip.vue';
import MkReactionsViewerDetails from '@/components/MkReactionsViewer.details.vue';
import MkRippleEffect from '@/components/MkRippleEffect.vue';
import { notePage } from '@/filters/note.js';

export interface UseNoteProps {
	note: Misskey.entities.Note;
	pinned?: boolean;
	mock?: boolean;
	withHardMute?: boolean;
}

export interface UseNoteElements {
	rootEl?: Ref<HTMLElement | null>;
	menuButton?: Ref<HTMLElement | null>;
	renoteButton?: Ref<HTMLElement | null>;
	renoteTime?: Ref<HTMLElement | null>;
	reactButton?: Ref<HTMLElement | null>;
	heartReactButton?: Ref<HTMLElement | null>;
	quoteButton?: Ref<HTMLElement | null>;
	clipButton?: Ref<HTMLElement | null>;
}

export interface UseNoteOptions {
	inTimeline?: boolean;
	tl_withSensitive?: Ref<boolean>;
	inChannel?: ExtractInjectedType<typeof DIType['inChannel']>;
	currentClip?: Ref<Misskey.entities.Clip | null> | null;
	currentAntenna?: Ref<Misskey.entities.Antenna | null> | null;
	/**
	 * 長いNoteには自動翻訳を行わない (MkNote用).
	 * 詳細表示のMkNoteDetailedではNote数が少ないため自動翻訳をスキップしない.
	 */
	autoTranslateSkipLong?: boolean;
}

export function checkNoteWordMute(
	noteToCheck: Misskey.entities.Note,
	user: typeof $i,
	mutedWords: Array<string | string[]> | null,
): WordMuteResult {
	if (mutedWords != null) {
		const result = checkWordMute(noteToCheck, user, mutedWords);
		if (Array.isArray(result)) return result;

		const replyResult = noteToCheck.reply && checkWordMute(noteToCheck.reply, user, mutedWords);
		if (Array.isArray(replyResult)) return replyResult;

		const renoteResult = noteToCheck.renote && checkWordMute(noteToCheck.renote, user, mutedWords);
		if (Array.isArray(renoteResult)) return renoteResult;
	}

	return false;
}

export function checkBuiltinSoftMute(
	noteToCheck: Misskey.entities.Note,
	checkForSensitiveMedia: boolean,
): 'sensitiveMute' | false {
	if (checkForSensitiveMedia && noteToCheck.files?.some((v) => v.isSensitive)) {
		return 'sensitiveMute' as never;
	}

	return false;
}

/** MkNote, MkNoteDetailedの共通ロジック */
export function useNote(
	props: UseNoteProps,
	els: UseNoteElements = {},
	options: UseNoteOptions = {},
) {
	const inTimeline = options.inTimeline ?? false;
	const tl_withSensitive = options.tl_withSensitive ?? ref(true);
	const inChannel = options.inChannel ?? null;
	const currentClip = options.currentClip ?? null;
	const currentAntenna = options.currentAntenna ?? null;
	const autoTranslateSkipLong = options.autoTranslateSkipLong ?? false;

	const router = useRouter();

	// プラグインの割り込み処理
	let rawNote = deepClone(props.note);
	let hideByPlugin = false;
	const noteViewInterruptors = getPluginHandlers('note_view_interruptor');

	if (noteViewInterruptors.length > 0) {
		let result: Misskey.entities.Note | null = deepClone(rawNote);
		for (const interruptor of noteViewInterruptors) {
			try {
				result = interruptor.handler(result!) as Misskey.entities.Note | null;

				// nullになった場合（非表示）はこれ以上やることがないのでループを抜ける
				if (result == null) {
					break;
				}
			} catch (err) {
				console.error(err);
			}
		}
		if (result == null) {
			hideByPlugin = true;
		} else {
			rawNote = result;
		}
	}

	// 基本状態
	const isRenote = Misskey.note.isPureRenote(rawNote);
	const appearNote = getAppearNote(rawNote) ?? rawNote;

	// キャプチャ（ストリーム購読）
	const { $note: $appearNote, subscribe: subscribeManuallyToNoteCapture } = useNoteCapture({
		note: appearNote,
		parentNote: rawNote,
		mock: props.mock,
	});

	// 各種フラグ状態
	const showContent = ref(false);
	const isDeleted = ref(false);
	const translateStatus = ref<TranslateStatus>('none');
	const translation = ref<Misskey.entities.NotesTranslateResponse | null>(null);
	const viewTextSource = ref(false);
	const noNyaize = ref(false);

	// ミュート判定
	// mutedはミュート解除の操作で書き換わるのでrefだが、hardMutedは解除できないのでリアクティブにしない
	const muted = ref($i ? checkNoteWordMute(appearNote, $i, $i.mutedWords) || checkBuiltinSoftMute(appearNote, inTimeline && !tl_withSensitive.value) : false);
	const hardMuted = props.withHardMute && $i ? checkNoteWordMute(appearNote, $i, $i.hardMutedWords) : false;

	// 導出値
	// rawNote / appearNote / $i.id / prefer.s は変化しないので一度だけ計算する
	const isMyRenote = $i != null && ($i.id === rawNote.userId);
	const parsed = appearNote.text ? parseMfmCached(appearNote.text) : null;
	const urls = parsed ? extractUrlFromMfm(parsed).filter((url) => appearNote.renote?.url !== url && appearNote.renote?.uri !== url) : null;
	const isLong = shouldCollapsed(appearNote, urls ?? []);
	const isMFM = shouldMfmCollapsed(appearNote);
	const isAnimatedMfm = $i ? undefined : shouldAnimatedMfm(appearNote);
	const enableAnimatedMfm = $i ? true : prefer.model('animatedMfm');
	const collapsed = ref(appearNote.cw == null && ((isLong && prefer.s.collapseLongNoteContent) || (isMFM && prefer.s.collapseDefault) || ((appearNote.files?.length ?? 0) > 0 && prefer.s.allMediaNoteCollapse)));
	const canRenote = ['public', 'home'].includes(appearNote.visibility) || (appearNote.visibility === 'followers' && appearNote.userId === $i?.id);
	const showTicker = (prefer.s.instanceTicker === 'always') || (prefer.s.instanceTicker === 'remote' && appearNote.user.instance);
	const renoteCollapsed = ref(
		isRenote && (
			prefer.s.forceCollapseAllRenotes || (
				prefer.s.collapseRenotes && (
					($i && ($i.id === rawNote.userId || $i.id === appearNote.userId)) || // `||` must be `||`! See https://github.com/misskey-dev/misskey/issues/13131
					($appearNote.myReaction != null)
				)
			)
		),
	);
	const replyCollapsed = ref(
		prefer.s.collapseReplies && appearNote.reply != null && $appearNote.myReaction == null,
	);
	const expandOnNoteClick = prefer.s.expandOnNoteClick;

	const pleaseLoginContext: OpenOnRemoteOptions = {
		type: 'lookup',
		url: `https://${host}/notes/${appearNote.id}`,
	};

	const replyTo = computed(() => {
		const username = appearNote.reply?.user.host == null ? `@${appearNote.reply?.user.username}` : `@${appearNote.reply?.user.username}@${toUnicode(appearNote.reply?.user.host)}`;
		const text = i18n.tsx.replyTo({ user: username });
		const user = `<span style="color: var(--MI_THEME-accent); margin-right: 0.25em;">${username}</span>`;

		return text.replace(username, user);
	});

	// グローバルイベントの監視
	useGlobalEvent('noteDeleted', (noteId) => {
		if (noteId === rawNote.id || noteId === appearNote.id) {
			isDeleted.value = true;
		}
	});

	// ツールチップのセットアップ (Mockでない場合のみ)
	if (!props.mock) {
		if (els.renoteButton != null) {
			useTooltip(els.renoteButton, async (showing) => {
				const renotes = await misskeyApi('notes/renotes', {
					noteId: appearNote.id,
					limit: 11,
				});
				const users = renotes.map(x => x.user);
				if (users.length < 1 || els.renoteButton!.value == null) return;
				const { dispose } = os.popup(MkUsersTooltip, {
					showing,
					users,
					count: appearNote.renoteCount,
					anchorElement: els.renoteButton!.value,
				}, {
					closed: () => dispose(),
				});
			});
		}

		if (appearNote.reactionAcceptance === 'likeOnly' && els.reactButton != null) {
			useTooltip(els.reactButton, async (showing) => {
				const reactions = await misskeyApi('notes/reactions', {
					noteId: appearNote.id,
					limit: 10,
				});
				const users = reactions.map(x => x.user);
				if (users.length < 1 || els.reactButton!.value == null) return;
				const { dispose } = os.popup(MkReactionsViewerDetails, {
					showing,
					reaction: '❤️',
					users,
					count: $appearNote.reactionCount,
					anchorElement: els.reactButton!.value,
				}, {
					closed: () => dispose(),
				});
			});
		}
	}

	if (prefer.s.alwaysShowCw) showContent.value = true;

	watch(() => viewTextSource.value, () => {
		collapsed.value = false;
	});

	const isForeignLanguage: boolean = (appearNote.text != null || appearNote.poll != null) && (() => {
		const targetLang = (miLocalStorage.getItem('lang') ?? navigator.language).slice(0, 2);
		if (appearNote.text) {
			const postLang = detectLanguage(appearNote.text);
			if (postLang !== '' && postLang !== targetLang) return true;
		}
		if (appearNote.poll) {
			const foreignLang = appearNote.poll.choices
				.map((choice) => detectLanguage(choice.text))
				.filter((lang) => lang !== targetLang).length;
			if (0 < foreignLang) return true;
		}
		return false;
	})();

	if (prefer.s.useAutoTranslate && instance.translatorAvailable && $i && $i.policies.canUseTranslator && $i.policies.canUseAutoTranslate && (!autoTranslateSkipLong || !isLong) && (appearNote.cw == null || showContent.value) && appearNote.text && isForeignLanguage) translate(true);

	function noteClick(ev: MouseEvent): void {
		if (!expandOnNoteClick || window.getSelection()?.toString() !== '' || prefer.s.expandOnNoteClickBehavior === 'doubleClick') ev.stopPropagation();
		else router.pushByPath(notePage(appearNote));
	}

	function noteDblClick(ev: MouseEvent): void {
		if (!expandOnNoteClick || window.getSelection()?.toString() !== '' || prefer.s.expandOnNoteClickBehavior === 'click') ev.stopPropagation();
		else router.pushByPath(notePage(appearNote));
	}

	// 共通アクション関数群
	async function renote() {
		haptic();

		if (props.mock) return;
		const isLoggedIn = await pleaseLogin({ openOnRemote: pleaseLoginContext });
		if (!isLoggedIn) return;
		showMovedDialog();
		if (els.renoteButton == null) return;
		const { menu } = await getRenoteMenu({
			note: rawNote,
			renoteButton: els.renoteButton,
			mock: props.mock,
		});
		os.popupMenu(menu, els.renoteButton.value);
		subscribeManuallyToNoteCapture();
	}

	async function renoteOnly() {
		haptic();

		if (props.mock) return;
		const isLoggedIn = await pleaseLogin({ openOnRemote: pleaseLoginContext });
		if (!isLoggedIn) return;
		showMovedDialog();
		if (els.renoteButton == null) return;
		await getRenoteOnly({
			note: rawNote,
			renoteButton: els.renoteButton,
			mock: props.mock,
		});
		subscribeManuallyToNoteCapture();
	}

	function quote(): void {
		haptic();

		pleaseLogin({ openOnRemote: pleaseLoginContext });
		if (!$i) return;
		if (props.mock) return;
		if (appearNote.channel) {
			if (appearNote.channel.allowRenoteToExternal) {
				const { menu } = getQuoteMenu({ note: rawNote, mock: props.mock });
				os.popupMenu(menu, els.quoteButton?.value);
			} else {
				os.post({
					renote: appearNote,
					channel: appearNote.channel,
				}).then(() => {
					focus();
				});
			}
		} else {
			os.post({
				renote: appearNote,
			}).then(() => {
				focus();
			});
		}
	}

	async function reply() {
		haptic();

		if (props.mock) return;
		const isLoggedIn = await pleaseLogin({ openOnRemote: pleaseLoginContext });
		if (!$i) return;
		if (!isLoggedIn) return;
		os.post({
			reply: appearNote,
			channel: appearNote.channel,
		}).then(() => {
			focus();
		});
	}

	async function react(createReactionMock?: (reaction: string) => void) {
		haptic();

		const isLoggedIn = await pleaseLogin({ openOnRemote: pleaseLoginContext });
		if (!isLoggedIn) return;
		showMovedDialog();

		if (appearNote.reactionAcceptance === 'likeOnly') {
			if (props.mock) return;
			notesReactionsCreate({
				noteId: appearNote.id,
				reaction: '❤️',
			}).then(({ canceled }) => {
				if (canceled) return;
				noteEvents.emit(`reacted:${appearNote.id}`, { userId: $i!.id, reaction: '❤️' });
			});
			if (els.reactButton != null && els.reactButton.value != null && prefer.s.animation) {
				const rect = els.reactButton.value.getBoundingClientRect();
				const { dispose } = os.popup(MkRippleEffect, {
					x: rect.left + (els.reactButton.value.offsetWidth / 2),
					y: rect.top + (els.reactButton.value.offsetHeight / 2),
				}, {
					end: () => dispose(),
				});
			}
		} else {
			blur();
			reactionPicker.show(els.reactButton?.value ?? null, rawNote, async (reaction) => {
				if (props.mock) {
					if (createReactionMock) createReactionMock(reaction);
					return;
				}
				await toggleReaction(reaction);
			}, () => { focus(); });
		}
	}

	async function toggleReaction(reaction: string) {
		const oldReaction = $appearNote.myReaction;
		if (oldReaction) {
			const confirm = await os.confirm({
				type: 'warning',
				text: oldReaction !== reaction ? i18n.ts.changeReactionConfirm : i18n.ts.cancelReactionConfirm,
			});
			if (confirm.canceled) return;

			sound.playMisskeySfx('reaction');

			misskeyApi('notes/reactions/delete', {
				noteId: appearNote.id,
			}).then(() => {
				noteEvents.emit(`unreacted:${appearNote.id}`, {
					userId: $i!.id,
					reaction: oldReaction,
				});

				if (oldReaction !== reaction) {
					misskeyApi('notes/reactions/create', {
						noteId: appearNote.id,
						reaction: reaction,
					}).then(() => {
						noteEvents.emit(`reacted:${appearNote.id}`, {
							userId: $i!.id,
							reaction: reaction,
						});
					});
				}
			});
		} else {
			notesReactionsCreate({
				noteId: appearNote.id,
				reaction: reaction,
			}).then(({ canceled }) => {
				if (canceled) return;
				noteEvents.emit(`reacted:${appearNote.id}`, {
					userId: $i!.id,
					reaction: reaction,
				});
			});
		}

		if (appearNote.text && appearNote.text.length > 100 && (Date.now() - new Date(appearNote.createdAt).getTime() < 1000 * 3)) {
			claimAchievement('reactWithoutRead');
		}
	}

	async function reactViaMfmEmoji(reaction: string) {
		if (props.mock) return;
		const isLoggedIn = await pleaseLogin({ openOnRemote: pleaseLoginContext });
		if (!isLoggedIn) return;
		showMovedDialog();
		notesReactionsCreate({
			noteId: appearNote.id,
			reaction: reaction,
		}).then(({ canceled }) => {
			if (canceled) return;
			noteEvents.emit(`reacted:${appearNote.id}`, {
				userId: $i!.id,
				reaction: reaction,
			});
		});
	}

	function undoReact(): void {
		const oldReaction = $appearNote.myReaction;
		if (!oldReaction) return;
		if (props.mock) return;
		misskeyApi('notes/reactions/delete', { noteId: appearNote.id }).then(() => {
			noteEvents.emit(`unreacted:${appearNote.id}`, { userId: $i!.id, reaction: oldReaction });
		});
	}

	function toggleReact(customMockCallback?: (reaction: string) => void) {
		haptic();

		if ($appearNote.myReaction != null && appearNote.reactionAcceptance === 'likeOnly') {
			if (props.mock && customMockCallback) {
				customMockCallback($appearNote.myReaction);
			} else {
				undoReact();
			}
		} else {
			react(customMockCallback);
		}
	}

	function heartReact(): void {
		haptic();

		pleaseLogin({ openOnRemote: pleaseLoginContext });
		showMovedDialog();

		if (props.mock) return;

		notesReactionsCreate({
			noteId: appearNote.id,
			reaction: prefer.s.selectReaction,
		}).then(({ canceled }) => {
			if (canceled) return;

			noteEvents.emit(`reacted:${appearNote.id}`, {
				userId: $i!.id,
				reaction: prefer.s.selectReaction,
			});

			if (appearNote.text && appearNote.text.length > 100 && (Date.now() - new Date(appearNote.createdAt).getTime() < 1000 * 3)) {
				claimAchievement('reactWithoutRead');
			}

			const el = els.heartReactButton?.value;
			if (el && prefer.s.animation) {
				const rect = el.getBoundingClientRect();
				const x = rect.left + (el.offsetWidth / 2);
				const y = rect.top + (el.offsetHeight / 2);
				const { dispose } = os.popup(MkRippleEffect, { x, y }, {
					end: () => dispose(),
				});
			}
		});
	}

	async function translate(isAuto: boolean): Promise<void> {
		if (translation.value != null) return;
		translateStatus.value = 'running';
		collapsed.value = false;

		if (appearNote.text == null) {
			translateStatus.value = 'success';
			translation.value = null;
			return;
		}

		if (!isAuto) {
			haptic();
		}

		if (props.mock) {
			return;
		}

		await misskeyApi('notes/translate', {
			noteId: appearNote.id,
			targetLang: miLocalStorage.getItem('lang') ?? navigator.language,
		}).then((r) => {
			translateStatus.value = 'success';
			translation.value = r;
		}).catch((err) => {
			translateStatus.value = 'error';
			translation.value = null;
			if (!isAuto) {
				os.alert(
					{
						type: 'error',
						title: i18n.ts.translateError,
						text: err.id,
					});
			}
		});
	}

	function onContextmenu(ev: PointerEvent): void {
		if (props.mock) return;
		if (ev.target && isLink(ev.target as HTMLElement)) return;
		if (window.getSelection()?.toString() !== '') return;

		if (prefer.s.useReactionPickerForContextMenu) {
			ev.preventDefault();
			react();
		} else {
			const { menu, cleanup } = getNoteMenu({
				note: rawNote,
				collapsed,
				translation,
				translateStatus,
				viewTextSource,
				noNyaize,
				currentClip: currentClip?.value,
				currentAntenna: currentAntenna?.value ?? undefined,
			});
			os.contextMenu(menu, ev).then(focus).finally(cleanup);
		}
	}

	function showMenu(): void {
		if (props.mock || els.menuButton == null) return;

		haptic();

		const { menu, cleanup } = getNoteMenu({
			note: rawNote,
			collapsed,
			translation,
			translateStatus,
			viewTextSource,
			noNyaize,
			currentClip: currentClip?.value,
			currentAntenna: currentAntenna?.value ?? undefined,
		});
		os.popupMenu(menu, els.menuButton.value).then(focus).finally(cleanup);
	}

	async function clip(): Promise<void> {
		if (props.mock) return;

		haptic();

		os.popupMenu(await getNoteClipMenu({
			note: rawNote,
			currentClip: currentClip?.value,
		}), els.clipButton?.value).then(focus);
	}

	async function showRenoteMenu() {
		if (props.mock) return;
		const isLoggedIn = await pleaseLogin({ openOnRemote: pleaseLoginContext });
		if (!isLoggedIn) return;

		const getUnrenote = () => ({
			text: i18n.ts.unrenote,
			icon: 'ti ti-trash',
			danger: true,
			action: () => {
				misskeyApi('notes/delete', { noteId: rawNote.id }).then(() => { globalEvents.emit('noteDeleted', rawNote.id); });
			},
		});

		const menuItems: MenuItem[] = [{
			type: 'link',
			text: i18n.ts.renoteDetails,
			icon: 'ti ti-info-circle',
			to: notePage(rawNote),
		}];

		if (props.note.channelId != null && (inChannel == null || props.note.channelId !== inChannel.value)) {
			menuItems.push({
				type: 'link',
				text: i18n.ts.viewRenotedChannel,
				icon: 'ti ti-device-tv',
				to: `/channels/${props.note.channelId}`,
			});
		}

		menuItems.push(getCopyNoteLinkMenu(rawNote, i18n.ts.copyLinkRenote));
		menuItems.push({ type: 'divider' });

		if (isMyRenote) {
			menuItems.push(getUnrenote());
			os.popupMenu(menuItems, els.renoteTime?.value);
		} else {
			menuItems.push(getAbuseNoteMenu(rawNote, i18n.ts.reportAbuseRenote));
			if ($i?.isModerator || $i?.isAdmin) {
				menuItems.push(getUnrenote());
			}

			os.popupMenu(menuItems, els.renoteTime?.value);
		}
	}

	// フォーカス制御
	function focus() { els.rootEl?.value?.focus(); }

	function blur() { els.rootEl?.value?.blur(); }

	return {
		// 状態・データ
		note: rawNote,
		appearNote,
		$appearNote,
		hideByPlugin,
		isRenote,
		isMyRenote,
		showContent,
		isDeleted,
		translateStatus,
		translation,
		viewTextSource,
		noNyaize,
		muted,
		hardMuted,
		collapsed,
		renoteCollapsed,
		replyCollapsed,
		isMFM,
		isAnimatedMfm,
		enableAnimatedMfm,
		expandOnNoteClick,

		// 導出値
		parsed,
		urls,
		isLong,
		showTicker,
		canRenote,
		replyTo,
		isForeignLanguage,

		// アクション関数
		renote,
		renoteOnly,
		quote,
		reply,
		react,
		reactViaMfmEmoji,
		heartReact,
		translate,
		toggleReact,
		undoReact,
		onContextmenu,
		showMenu,
		clip,
		showRenoteMenu,
		noteClick,
		noteDblClick,
		focus,
		blur,
	};
}
