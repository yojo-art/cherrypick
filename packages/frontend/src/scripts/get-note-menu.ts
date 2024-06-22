/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { defineAsyncComponent, Ref, ShallowRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import { claimAchievement } from './achievements.js';
import { $i } from '@/account.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import copyToClipboard from '@/scripts/copy-to-clipboard.js';
import { url } from '@/config.js';
import { defaultStore, noteActions } from '@/store.js';
import { miLocalStorage } from '@/local-storage.js';
import { getUserMenu } from '@/scripts/get-user-menu.js';
import { clipsCache, favoritedChannelsCache } from '@/cache.js';
import { MenuItem } from '@/types/menu.js';
import MkRippleEffect from '@/components/MkRippleEffect.vue';
import { isSupportShare } from '@/scripts/navigator.js';
import { addDividersBetweenMenuSections } from '@/scripts/add-dividers-between-menu-sections.js';

export async function getNoteClipMenu(props: {
	note: Misskey.entities.Note;
	isDeleted: Ref<boolean>;
	currentClip?: Misskey.entities.Clip;
}) {
	function getClipName(clip: Misskey.entities.Clip) {
		if ($i && clip.userId === $i.id && clip.notesCount != null) {
			return `${clip.name} (${clip.notesCount}/${$i.policies.noteEachClipsLimit})`;
		} else {
			return clip.name;
		}
	}

	const isRenote = (
		props.note.renote != null &&
		props.note.text == null &&
		props.note.fileIds.length === 0 &&
		props.note.poll == null
	);

	const appearNote = isRenote ? props.note.renote as Misskey.entities.Note : props.note;

	const clips = await clipsCache.fetch();
	const menu: MenuItem[] = [...clips.map(clip => ({
		text: getClipName(clip),
		action: () => {
			claimAchievement('noteClipped1');
			os.promiseDialog(
				misskeyApi('clips/add-note', { clipId: clip.id, noteId: appearNote.id }),
				null,
				async (err) => {
					if (err.id === '734806c4-542c-463a-9311-15c512803965') {
						const confirm = await os.confirm({
							type: 'warning',
							text: i18n.tsx.confirmToUnclipAlreadyClippedNote({ name: clip.name }),
						});
						if (!confirm.canceled) {
							os.apiWithDialog('clips/remove-note', { clipId: clip.id, noteId: appearNote.id }).then(() => {
								clipsCache.set(clips.map(c => {
									if (c.id === clip.id) {
										return {
											...c,
											notesCount: Math.max(0, ((c.notesCount ?? 0) - 1)),
										};
									} else {
										return c;
									}
								}));
							});
							if (props.currentClip?.id === clip.id) props.isDeleted.value = true;
						}
					} else {
						os.alert({
							type: 'error',
							text: err.message + '\n' + err.id,
						});
					}
				},
			).then(() => {
				clipsCache.set(clips.map(c => {
					if (c.id === clip.id) {
						return {
							...c,
							notesCount: (c.notesCount ?? 0) + 1,
						};
					} else {
						return c;
					}
				}));
			});
		},
	})), clips.length > 0 ? { type: 'divider' } : undefined, {
		icon: 'ti ti-plus',
		text: i18n.ts.createNew,
		action: async () => {
			const { canceled, result } = await os.form(i18n.ts.createNewClip, {
				name: {
					type: 'string',
					label: i18n.ts.name,
				},
				description: {
					type: 'string',
					required: false,
					multiline: true,
					label: i18n.ts.description,
				},
				isPublic: {
					type: 'boolean',
					label: i18n.ts.public,
					default: false,
				},
			});
			if (canceled) return;

			const clip = await os.apiWithDialog('clips/create', result);

			clipsCache.delete();

			claimAchievement('noteClipped1');
			os.apiWithDialog('clips/add-note', { clipId: clip.id, noteId: appearNote.id });
		},
	}];

	return menu;
}

export function getAbuseNoteMenu(note: Misskey.entities.Note, text: string): MenuItem {
	return {
		icon: 'ti ti-exclamation-circle',
		text,
		action: (): void => {
			const localUrl = `${url}/notes/${note.id}`;
			const username = '@' + note.user.username;
			const host = note.user.host ? '@' + note.user.host : '';
			let noteInfo = '';
			if (note.url ?? note.uri != null) noteInfo = `Note: ${note.url ?? note.uri}\n`;
			noteInfo += `Local Note: ${localUrl}\n`;
			os.popup(defineAsyncComponent(() => import('@/components/MkAbuseReportWindow.vue')), {
				user: note.user,
				initialComment: `${noteInfo}User: ${username + host}\n-----\n`,
			}, {}, 'closed');
		},
	};
}

export function getCopyNoteLinkMenu(note: Misskey.entities.Note, text: string): MenuItem {
	return {
		icon: 'ti ti-link',
		text,
		action: (): void => {
			copyToClipboard(`${url}/notes/${note.id}`);
			os.toast(i18n.ts.copiedLink, 'copied');
		},
	};
}

export function getNoteMenu(props: {
	note: Misskey.entities.Note;
	translation: Ref<Misskey.entities.NotesTranslateResponse | null>;
	translating: Ref<boolean>;
	viewTextSource: Ref<boolean>;
	noNyaize: Ref<boolean>;
	isDeleted: Ref<boolean>;
	currentClip?: Misskey.entities.Clip;
}) {
	const isRenote = (
		props.note.renote != null &&
		props.note.text == null &&
		props.note.fileIds.length === 0 &&
		props.note.poll == null
	);

	const appearNote = isRenote ? props.note.renote as Misskey.entities.Note : props.note;

	const cleanups = [] as (() => void)[];

	function del(): void {
		os.confirm({
			type: 'warning',
			text: i18n.ts.noteDeleteConfirm,
		}).then(({ canceled }) => {
			if (canceled) return;

			misskeyApi('notes/delete', {
				noteId: appearNote.id,
			});

			if (Date.now() - new Date(appearNote.createdAt).getTime() < 1000 * 60) {
				claimAchievement('noteDeletedWithin1min');
			}
		});
	}

	function delEdit(): void {
		os.confirm({
			type: 'warning',
			text: i18n.ts.deleteAndEditConfirm,
		}).then(({ canceled }) => {
			if (canceled) return;

			misskeyApi('notes/delete', {
				noteId: appearNote.id,
			});

			os.post({ initialNote: appearNote, renote: appearNote.renote, reply: appearNote.reply, channel: appearNote.channel });

			if (Date.now() - new Date(appearNote.createdAt).getTime() < 1000 * 60) {
				claimAchievement('noteDeletedWithin1min');
			}
		});
	}

	async function edit(): Promise<void> {
		const neverShowInfo = miLocalStorage.getItem('neverShowNoteEditInfo');

		if (neverShowInfo !== 'true') {
			const confirm = await os.actions({
				type: 'warning',
				title: i18n.ts.disableNoteEditConfirm,
				text: i18n.ts.disableNoteEditConfirmWarn,
				actions: [
					{
						value: 'yes' as const,
						text: i18n.ts.disableNoteEditOk,
					},
					{
						value: 'neverShow' as const,
						text: `${i18n.ts.disableNoteEditOk} (${i18n.ts.neverShow})`,
						danger: true,
					},
					{
						value: 'no' as const,
						text: i18n.ts.cancel,
						primary: true,
					},
				],
			});
			if (confirm.canceled) return;
			if (confirm.result === 'no') return;

			if (confirm.result === 'neverShow') {
				miLocalStorage.setItem('neverShowNoteEditInfo', 'true');
			}
		}

		await os.post({ initialNote: appearNote, renote: appearNote.renote, reply: appearNote.reply, channel: appearNote.channel, updateMode: true });
	}

	function copyEdit(): void {
		os.confirm({
			type: 'info',
			text: i18n.ts.copyAndEditConfirm,
		}).then(({ canceled }) => {
			if (canceled) return;

			os.post({ initialNote: appearNote, renote: appearNote.renote, reply: appearNote.reply, channel: appearNote.channel });
		});
	}

	function toggleFavorite(favorite: boolean): void {
		claimAchievement('noteFavorited1');
		os.apiWithDialog(favorite ? 'notes/favorites/create' : 'notes/favorites/delete', {
			noteId: appearNote.id,
		});
	}

	function toggleThreadMute(mute: boolean): void {
		os.apiWithDialog(mute ? 'notes/thread-muting/create' : 'notes/thread-muting/delete', {
			noteId: appearNote.id,
		});
	}

	function copyContent(): void {
		copyToClipboard(appearNote.text);
		os.toast(i18n.ts.copiedContent, 'copied');
	}

	function copyLink(): void {
		copyToClipboard(`${url}/notes/${appearNote.id}`);
		os.toast(i18n.ts.copiedLink, 'copied');
	}

	function openInNewTab(): void {
		window.open(`${url}/notes/${appearNote.id}`, '_blank', 'noopener');
	}

	function togglePin(pin: boolean): void {
		os.apiWithDialog(pin ? 'i/pin' : 'i/unpin', {
			noteId: appearNote.id,
		}, undefined, null, res => {
			if (res.id === '72dab508-c64d-498f-8740-a8eec1ba385a') {
				os.alert({
					type: 'error',
					text: i18n.ts.pinLimitExceeded,
				});
			}
		});
	}

	async function unclip(): Promise<void> {
		os.apiWithDialog('clips/remove-note', { clipId: props.currentClip.id, noteId: appearNote.id });
		props.isDeleted.value = true;
	}

	async function promote(): Promise<void> {
		const { canceled, result: days } = await os.inputNumber({
			title: i18n.ts.numberOfDays,
		});

		if (canceled) return;

		os.apiWithDialog('admin/promo/create', {
			noteId: appearNote.id,
			expiresAt: Date.now() + (86400000 * days),
		});
	}

	function share(): void {
		navigator.share({
			title: i18n.tsx.noteOf({ user: appearNote.user.name }),
			text: appearNote.text,
			url: `${url}/notes/${appearNote.id}`,
		});
	}

	function openDetail(): void {
		os.pageWindow(`/notes/${appearNote.id}`);
	}

	function showReactions(): void {
		os.popup(defineAsyncComponent(() => import('@/components/MkReactedUsersDialog.vue')), {
			noteId: appearNote.id,
		}, {}, 'closed');
	}

	function showRenotes(): void {
		os.popup(defineAsyncComponent(() => import('@/components/MkRenotedUsersDialog.vue')), {
			noteId: appearNote.id,
		}, {}, 'closed');
	}

	async function translate(): Promise<void> {
		if (props.translation.value != null) return;
		props.translating.value = true;
		const res = await misskeyApi('notes/translate', {
			noteId: appearNote.id,
			targetLang: miLocalStorage.getItem('lang') ?? navigator.language,
		});
		props.translating.value = false;
		props.translation.value = res;
	}

	function showViewTextSource(): void {
		props.viewTextSource.value = true;
	}

	function noNyaizeText(): void {
		props.noNyaize.value = true;
	}

	function revertNoNyaizeText(): void {
		props.noNyaize.value = false;
	}

	let menu: MenuItem[];
	if ($i) {
		const statePromise = misskeyApi('notes/state', {
			noteId: appearNote.id,
		});

		menu = [
			...(
				props.currentClip?.userId === $i.id ? [{
					icon: 'ti ti-backspace',
					text: i18n.ts.unclip,
					danger: true,
					action: unclip,
				}, { type: 'divider' }] : []
			), ...(isSupportShare() ? [{
				icon: 'ti ti-share',
				text: i18n.ts.share,
				action: share,
			}] : []),
			getCopyNoteLinkMenu(appearNote, i18n.ts.copyLink)
			, {
				icon: 'ti ti-copy',
				text: i18n.ts.copyContent,
				action: copyContent,
			}, {
				icon: 'ti ti-external-link',
				text: i18n.ts.openInNewTab,
				action: openInNewTab,
			},
			$i && $i.policies.canUseTranslator && instance.translatorAvailable ? {
				icon: 'ti ti-language-hiragana',
				text: i18n.ts.translate,
				action: translate,
			} : undefined,
			{ type: 'divider' },
			statePromise.then(state => state.isFavorited ? {
				icon: 'ti ti-star-off',
				text: i18n.ts.unfavorite,
				action: () => toggleFavorite(false),
			} : {
				icon: 'ti ti-star',
				text: i18n.ts.favorite,
				action: () => toggleFavorite(true),
			}),
			{
				type: 'parent' as const,
				icon: 'ti ti-paperclip',
				text: i18n.ts.clip,
				children: () => getNoteClipMenu(props),
			},
			statePromise.then(state => state.isMutedThread ? {
				icon: 'ti ti-message-off',
				text: i18n.ts.unmuteThread,
				action: () => toggleThreadMute(false),
			} : {
				icon: 'ti ti-message-off',
				text: i18n.ts.muteThread,
				action: () => toggleThreadMute(true),
			}),
			appearNote.userId === $i.id ? ($i.pinnedNoteIds ?? []).includes(appearNote.id) ? {
				icon: 'ti ti-pinned-off',
				text: i18n.ts.unpin,
				action: () => togglePin(false),
			} : {
				icon: 'ti ti-pin',
				text: i18n.ts.pin,
				action: () => togglePin(true),
			} : undefined,
			{
				type: 'parent' as const,
				icon: 'ti ti-note',
				text: i18n.ts.note,
				children: [{
					icon: 'ti ti-info-circle',
					text: i18n.ts.details,
					action: openDetail,
				}, {
					icon: 'ti ti-repeat',
					text: i18n.ts.renotesList,
					action: showRenotes,
				}, {
					icon: 'ti ti-icons',
					text: i18n.ts.reactionsList,
					action: showReactions,
				}, (appearNote.url ?? appearNote.uri) ? {
					icon: 'ti ti-external-link',
					text: i18n.ts.showOnRemote,
					action: () => {
						window.open(appearNote.url ?? appearNote.uri, '_blank', 'noopener');
					},
				} : undefined
				, { type: 'divider' }
				, {
					icon: 'ti ti-source-code',
					text: i18n.ts.viewTextSource,
					action: showViewTextSource,
				}
				, props.noNyaize.value ? {
					icon: 'ti ti-paw-filled',
					text: i18n.ts.revertNoNyaization,
					action: revertNoNyaizeText,
				} : {
					icon: 'ti ti-paw-off',
					text: i18n.ts.noNyaization,
					action: noNyaizeText,
				}
				, (appearNote.userId === $i.id) ? { type: 'divider' } : undefined
				, (appearNote.userId === $i.id) ? {
					icon: 'ti ti-edit-circle',
					text: i18n.ts.copyAndEdit,
					action: copyEdit,
				} : undefined],
			},
			{
				type: 'parent' as const,
				icon: 'ti ti-user',
				text: i18n.ts.user,
				children: async () => {
					const user = appearNote.userId === $i?.id ? $i : await misskeyApi('users/show', { userId: appearNote.userId });
					const { menu, cleanup } = getUserMenu(user);
					cleanups.push(cleanup);
					return menu;
				},
			},
			/*
		...($i.isModerator || $i.isAdmin ? [
			{ type: 'divider' },
			{
				icon: 'ti ti-speakerphone',
				text: i18n.ts.promote,
				action: promote
			}]
			: []
		),*/
			...(appearNote.userId !== $i.id || (isRenote && props.note.userId !== $i.id) ? [
				{ type: 'divider' },
				appearNote.userId !== $i.id ? getAbuseNoteMenu(appearNote, i18n.ts.reportAbuse) : undefined,
				isRenote && props.note.userId !== $i.id ? getAbuseNoteMenu(props.note, i18n.ts.reportAbuseRenote) : undefined,
			]
			: []
			),
			...(appearNote.channel && (appearNote.channel.userId === $i.id || $i.isModerator || $i.isAdmin) ? [
				{ type: 'divider' },
				{
					type: 'parent' as const,
					icon: 'ti ti-device-tv',
					text: i18n.ts.channel,
					children: async () => {
						const channelChildMenu = [] as MenuItem[];

						const channel = await misskeyApi('channels/show', { channelId: appearNote.channel!.id });

						if (channel.pinnedNoteIds.includes(appearNote.id)) {
							channelChildMenu.push({
								icon: 'ti ti-pinned-off',
								text: i18n.ts.unpin,
								action: () => os.apiWithDialog('channels/update', {
									channelId: appearNote.channel!.id,
									pinnedNoteIds: channel.pinnedNoteIds.filter(id => id !== appearNote.id),
								}),
							});
						} else {
							channelChildMenu.push({
								icon: 'ti ti-pin',
								text: i18n.ts.pin,
								action: () => os.apiWithDialog('channels/update', {
									channelId: appearNote.channel!.id,
									pinnedNoteIds: [...channel.pinnedNoteIds, appearNote.id],
								}),
							});
						}
						return channelChildMenu;
					},
				},
			]
			: []
			),
			...(appearNote.userId === $i.id || $i.isModerator || $i.isAdmin ? [
				{ type: 'divider' },
				appearNote.userId === $i.id && $i.policies.canEditNote ? {
					icon: 'ti ti-edit',
					text: i18n.ts.edit,
					action: edit,
				} : undefined,
				appearNote.userId === $i.id ? {
					icon: 'ti ti-eraser',
					text: i18n.ts.deleteAndEdit,
					action: delEdit,
				} : undefined,
				{
					icon: 'ti ti-trash',
					text: i18n.ts.delete,
					danger: true,
					action: del,
				}]
			: []
			)]
			.filter(x => x !== undefined);
	} else {
		menu = [{
			icon: 'ti ti-info-circle',
			text: i18n.ts.details,
			action: openDetail,
		}, {
			icon: 'ti ti-copy',
			text: i18n.ts.copyContent,
			action: copyContent,
		}, getCopyNoteLinkMenu(appearNote, i18n.ts.copyLink)
		, (appearNote.url ?? appearNote.uri) ? {
			icon: 'ti ti-external-link',
			text: i18n.ts.showOnRemote,
			action: () => {
				window.open(appearNote.url ?? appearNote.uri, '_blank', 'noopener');
			},
		} : undefined]
			.filter(x => x !== undefined);
	}

	if (noteActions.length > 0) {
		menu = menu.concat([{ type: 'divider' }, ...noteActions.map(action => ({
			icon: 'ti ti-plug',
			text: action.title,
			action: () => {
				action.handler(appearNote);
			},
		}))]);
	}

	if (defaultStore.state.devMode) {
		menu = menu.concat([{ type: 'divider' }, {
			icon: 'ti ti-id',
			text: i18n.ts.copyNoteId,
			action: () => {
				copyToClipboard(appearNote.id);
				os.toast(i18n.ts.copied, 'copied');
			},
		}]);
	}

	const cleanup = () => {
		if (_DEV_) console.log('note menu cleanup', cleanups);
		for (const cl of cleanups) {
			cl();
		}
	};

	return {
		menu,
		cleanup,
	};
}

type Visibility = (typeof Misskey.noteVisibilities)[number];

function smallerVisibility(a: Visibility, b: Visibility): Visibility {
	if (a === 'specified' || b === 'specified') return 'specified';
	if (a === 'followers' || b === 'followers') return 'followers';
	if (a === 'home' || b === 'home') return 'home';
	// if (a === 'public' || b === 'public')
	return 'public';
}

export function getQuoteMenu(props: {
	note: Misskey.entities.Note,
	mock?: boolean;
}) {
	const isRenote = (
		props.note.renote != null &&
		props.note.text == null &&
		props.note.fileIds &&
		props.note.fileIds.length === 0 &&
		props.note.poll == null
	);
	const menu: MenuItem[] = [];
	const appearNote = isRenote ? props.note.renote as Misskey.entities.Note : props.note;

	if (!appearNote.channel || appearNote.channel.allowRenoteToExternal) {
		menu.push({
			text: i18n.ts.quote,
			icon: 'ti ti-quote',
			action: () => {
				os.post({
					renote: appearNote,
				});
			},
		});
	}

	if (appearNote.channel) {
		menu.push({
			text: i18n.ts.inChannelQuote,
			icon: 'ti ti-device-tv',
			action: () => {
				if (!props.mock) {
					os.post({
						renote: appearNote,
						channel: appearNote.channel,
					});
				}
			},
		});
	}

	return { menu };
}

export function getRenoteMenu(props: {
	note: Misskey.entities.Note;
	renoteButton: ShallowRef<HTMLElement | undefined>;
	mock?: boolean;
}) {
	const isRenote = (
		props.note.renote != null &&
		props.note.text == null &&
		props.note.fileIds &&
		props.note.fileIds.length === 0 &&
		props.note.poll == null
	);

	const appearNote = isRenote ? props.note.renote as Misskey.entities.Note : props.note;

	const channelRenoteItems: MenuItem[] = [];
	const normalRenoteItems: MenuItem[] = [];
	const normalExternalChannelRenoteItems: MenuItem[] = [];
	const visibilityRenoteItems: MenuItem[] = [];

	// Add channel renote/quote buttons
	if (appearNote.channel) {
		const channelRenoteButton = {
			text: i18n.ts.inChannelRenote,
			icon: 'ti ti-repeat',
			action: () => {
				const el = props.renoteButton.value;
				if (el) {
					const rect = el.getBoundingClientRect();
					const x = rect.left + (el.offsetWidth / 2);
					const y = rect.top + (el.offsetHeight / 2);
					os.popup(MkRippleEffect, { x, y }, {}, 'end');
				}

				if (!props.mock) {
					misskeyApi('notes/create', {
						renoteId: appearNote.id,
						channelId: appearNote.channelId,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				}
			},
		};
		if (defaultStore.state.renoteQuoteButtonSeparation) {
			normalRenoteItems.unshift(channelRenoteButton);
		} else {
			channelRenoteItems.push(channelRenoteButton);
		}

		// Add quote button if quote button is not separated
		if (!defaultStore.state.renoteQuoteButtonSeparation) {
			channelRenoteItems.push({
				text: i18n.ts.inChannelQuote,
				icon: 'ti ti-quote',
				action: () => {
					if (!props.mock) {
						os.post({
							renote: appearNote,
							channel: appearNote.channel,
						});
					}
				},
			});
		}
	}

	if (!appearNote.channel || appearNote.channel.allowRenoteToExternal) {
		normalRenoteItems.push({
			text: i18n.ts.renote,
			icon: 'ti ti-repeat',
			action: () => {
				const el = props.renoteButton.value;
				if (el) {
					const rect = el.getBoundingClientRect();
					const x = rect.left + (el.offsetWidth / 2);
					const y = rect.top + (el.offsetHeight / 2);
					os.popup(MkRippleEffect, { x, y }, {}, 'end');
				}

				const configuredVisibility = defaultStore.state.rememberNoteVisibility ? defaultStore.state.visibility : defaultStore.state.defaultNoteVisibility;
				const localOnly = defaultStore.state.rememberNoteVisibility ? defaultStore.state.localOnly : defaultStore.state.defaultNoteLocalOnly;

				let visibility = appearNote.visibility;
				visibility = smallerVisibility(visibility, configuredVisibility);
				if (appearNote.channel?.isSensitive) {
					visibility = smallerVisibility(visibility, 'home');
				}

				if (!props.mock) {
					misskeyApi('notes/create', {
						localOnly,
						visibility,
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				}
			},
		});

		// Add quote button if quote button is not separated
		if (!props.mock && !defaultStore.state.renoteQuoteButtonSeparation) {
			normalRenoteItems.push({
				text: i18n.ts.quote,
				icon: 'ti ti-quote',
				action: () => {
					os.post({
						renote: appearNote,
					});
				},
			});
		}

		normalExternalChannelRenoteItems.push({
			type: 'parent',
			icon: 'ti ti-repeat',
			text: appearNote.channel ? i18n.ts.renoteToOtherChannel : i18n.ts.renoteToChannel,
			children: async () => {
				const channels = await favoritedChannelsCache.fetch();
				return channels.filter((channel) => {
					if (!appearNote.channelId) return true;
					return channel.id !== appearNote.channelId;
				}).map((channel) => ({
					text: channel.name,
					action: () => {
						const el = props.renoteButton.value;
						if (el) {
							const rect = el.getBoundingClientRect();
							const x = rect.left + (el.offsetWidth / 2);
							const y = rect.top + (el.offsetHeight / 2);
							os.popup(MkRippleEffect, { x, y }, {}, 'end');
						}

						if (!props.mock) {
							misskeyApi('notes/create', {
								renoteId: appearNote.id,
								channelId: channel.id,
							}).then(() => {
								os.toast(i18n.tsx.renotedToX({ name: channel.name }));
							});
						}
					},
				}));
			},
		});

		// Add visibility section
		if (
			defaultStore.state.renoteVisibilitySelection &&
			!['followers', 'specified'].includes(appearNote.visibility)
		) {
			const localOnly = defaultStore.state.rememberNoteVisibility ? defaultStore.state.localOnly : defaultStore.state.defaultNoteLocalOnly;

			// renote to public
			if (appearNote.visibility === 'public') {
				visibilityRenoteItems.push({
					text: `${i18n.ts.renote} (${i18n.ts._visibility.public})`,
					icon: 'ti ti-world',
					action: () => {
						misskeyApi('notes/create', {
							localOnly,
							visibility: 'public',
							renoteId: appearNote.id,
						}).then(() => {
							os.toast(i18n.ts.renoted, 'renote');
						});
					},
				});
			}

			// renote to home
			if (['home', 'public'].includes(appearNote.visibility)) {
				visibilityRenoteItems.push({
					text: `${i18n.ts.renote} (${i18n.ts._visibility.home})`,
					icon: 'ti ti-home',
					action: () => {
						misskeyApi('notes/create', {
							localOnly,
							visibility: 'home',
							renoteId: appearNote.id,
						}).then(() => {
							os.toast(i18n.ts.renoted, 'renote');
						});
					},
				});
			}

			// renote to followers
			visibilityRenoteItems.push({
				text: `${i18n.ts.renote} (${i18n.ts._visibility.followers})`,
				icon: 'ti ti-lock',
				action: () => {
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'followers',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				},
			});
		}
	}

	const renoteItems = addDividersBetweenMenuSections(
		normalRenoteItems,
		channelRenoteItems,
		visibilityRenoteItems,
		normalExternalChannelRenoteItems,
	);

	return {
		menu: renoteItems,
	};
}

export async function getRenoteOnly(props: {
	note: Misskey.entities.Note;
	renoteButton: ShallowRef<HTMLElement | undefined>;
	mock?: boolean;
}) {
	const isRenote = (
		props.note.renote != null &&
		props.note.text == null &&
		props.note.fileIds &&
		props.note.fileIds.length === 0 &&
		props.note.poll == null
	);

	const appearNote = isRenote ? props.note.renote as Misskey.entities.Note : props.note;

	if (defaultStore.state.showRenoteConfirmPopup) {
		const { canceled } = await os.confirm({
			type: 'info',
			text: i18n.ts.renoteConfirm,
			caption: i18n.ts.renoteConfirmDescription,
		});
		if (canceled) return;
	}

	if (appearNote.channel) {
		const el = props.renoteButton.value as HTMLElement | null | undefined;
		if (el) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			os.popup(MkRippleEffect, { x, y }, {}, 'end');
		}

		if (!props.mock) {
			misskeyApi('notes/create', {
				renoteId: appearNote.id,
				channelId: appearNote.channelId,
			}).then(() => {
				os.toast(i18n.ts.renoted, 'renote');
			});
		}
	}

	if (!appearNote.channel || appearNote.channel.allowRenoteToExternal) {
		const el = props.renoteButton.value as HTMLElement | null | undefined;
		if (el) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			os.popup(MkRippleEffect, { x, y }, {}, 'end');
		}

		const configuredVisibility = defaultStore.state.rememberNoteVisibility ? defaultStore.state.visibility : defaultStore.state.defaultNoteVisibility;
		const localOnly = defaultStore.state.rememberNoteVisibility ? defaultStore.state.localOnly : defaultStore.state.defaultNoteLocalOnly;

		let visibility = appearNote.visibility;
		visibility = smallerVisibility(visibility, configuredVisibility);
		if (appearNote.channel?.isSensitive) {
			visibility = smallerVisibility(visibility, 'home');
		}

		if (!props.mock && defaultStore.state.renoteVisibilitySelection) {
			misskeyApi('notes/create', {
				localOnly,
				visibility,
				renoteId: appearNote.id,
			}).then(() => {
				os.toast(i18n.ts.renoted, 'renote');
			});
		}

		// Add visibility section
		if (
			!defaultStore.state.renoteVisibilitySelection &&
			appearNote.visibility !== 'specified'
		) {
			if (defaultStore.state.forceRenoteVisibilitySelection !== 'none') {
				if (appearNote.visibility === 'public' && defaultStore.state.forceRenoteVisibilitySelection === 'public') { // renote to public
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'public',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				} else if (['home', 'public'].includes(appearNote.visibility) && defaultStore.state.forceRenoteVisibilitySelection === 'home') { // renote to home
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'home',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				} else if (appearNote.visibility === 'followers' && defaultStore.state.forceRenoteVisibilitySelection === 'followers') { // renote to followers
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'followers',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				}
			} else {
				if (appearNote.visibility === 'public') { // renote to public
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'public',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				} else if (['home', 'public'].includes(appearNote.visibility)) { // renote to home
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'home',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				} else if (appearNote.visibility === 'followers') { // renote to followers
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'followers',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				}
			}
		}
	}
}
