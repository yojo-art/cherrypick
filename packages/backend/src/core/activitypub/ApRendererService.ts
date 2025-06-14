/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createPublicKey, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import * as mfm from 'mfc-js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { MiPartialLocalUser, MiLocalUser, MiPartialRemoteUser, MiRemoteUser, MiUser } from '@/models/User.js';
import type { IMentionedRemoteUsers, MiNote } from '@/models/Note.js';
import type { MiBlocking } from '@/models/Blocking.js';
import type { MiRelay } from '@/models/Relay.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import type { MiNoteReaction } from '@/models/NoteReaction.js';
import type { MiEmoji } from '@/models/Emoji.js';
import type { MiPoll } from '@/models/Poll.js';
import type { MiPollVote } from '@/models/PollVote.js';
import type { MiMessagingMessage } from '@/models/MessagingMessage.js';
import { UserKeypairService } from '@/core/UserKeypairService.js';
import { MfmService } from '@/core/MfmService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import type { MiUserKeypair } from '@/models/UserKeypair.js';
import type { UsersRepository, UserProfilesRepository, NotesRepository, DriveFilesRepository, PollsRepository, EventsRepository, MiClip } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { IdService } from '@/core/IdService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { searchableTypes } from '@/types.js';
import { JsonLdService } from './JsonLdService.js';
import { ApMfmService } from './ApMfmService.js';
import { CONTEXT } from './misc/contexts.js';
import { toSerchableByProperty } from './misc/searchableBy.js';
import type { IAccept, IActivity, IAdd, IAnnounce, IApDocument, IApEmoji, IApHashtag, IApImage, IApMention, IApReversi, IBlock, IClip, ICreate, IDelete, IFlag, IFollow, IInvite, IJoin, IKey, ILeave, ILike, IMove, IObject, IOrderedCollection, IPost, IQuestion, IRead, IReject, IRemove, ITombstone, IUndo, IUpdate } from './type.js';

@Injectable()
export class ApRendererService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		@Inject(DI.eventsRepository)
		private eventsRepository: EventsRepository,

		private customEmojiService: CustomEmojiService,
		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private jsonLdService: JsonLdService,
		private userKeypairService: UserKeypairService,
		private apMfmService: ApMfmService,
		private mfmService: MfmService,
		private idService: IdService,
		private utilityService: UtilityService,
	) {
	}

	@bindThis
	public renderAccept(object: string | IObject, user: { id: MiUser['id']; host: null }): IAccept {
		return {
			type: 'Accept',
			actor: this.userEntityService.genLocalUserUri(user.id),
			object,
		};
	}

	@bindThis
	public renderAdd(user: MiLocalUser, target: string | IObject | undefined, object: string | IObject): IAdd {
		return {
			type: 'Add',
			actor: this.userEntityService.genLocalUserUri(user.id),
			target,
			object,
		};
	}

	@bindThis
	public renderAnnounce(object: string | IObject, note: MiNote): IAnnounce {
		const attributedTo = this.userEntityService.genLocalUserUri(note.userId);

		let to: string[] = [];
		let cc: string[] = [];

		if (note.visibility === 'public') {
			to = ['https://www.w3.org/ns/activitystreams#Public'];
			cc = [`${attributedTo}/followers`];
		} else if (note.visibility === 'home') {
			to = [`${attributedTo}/followers`];
			cc = ['https://www.w3.org/ns/activitystreams#Public'];
		} else if (note.visibility === 'followers') {
			to = [`${attributedTo}/followers`];
			cc = [];
		} else {
			throw new Error('renderAnnounce: cannot render non-public note');
		}

		return {
			id: `${this.config.url}/notes/${note.id}/activity`,
			actor: this.userEntityService.genLocalUserUri(note.userId),
			type: 'Announce',
			published: this.idService.parse(note.id).date.toISOString(),
			updated: note.updatedAt?.toISOString() ?? undefined,
			to,
			cc,
			object,
		};
	}

	/**
	 * Renders a block into its ActivityPub representation.
	 *
	 * @param block The block to be rendered. The blockee relation must be loaded.
	 */
	@bindThis
	public renderBlock(block: MiBlocking): IBlock {
		if (block.blockee?.uri == null) {
			throw new Error('renderBlock: missing blockee uri');
		}

		return {
			type: 'Block',
			id: `${this.config.url}/blocks/${block.id}`,
			actor: this.userEntityService.genLocalUserUri(block.blockerId),
			object: block.blockee.uri,
		};
	}

	@bindThis
	public renderCreate(object: IObject, note: MiNote): ICreate {
		const activity: ICreate = {
			id: `${this.config.url}/notes/${note.id}/activity`,
			actor: this.userEntityService.genLocalUserUri(note.userId),
			type: 'Create',
			published: this.idService.parse(note.id).date.toISOString(),
			object,
		};

		if (object.to) activity.to = object.to;
		if (object.cc) activity.cc = object.cc;

		return activity;
	}

	@bindThis
	public renderDelete(object: IObject | string, user: { id: MiUser['id']; host: null }): IDelete {
		return {
			type: 'Delete',
			actor: this.userEntityService.genLocalUserUri(user.id),
			object,
			published: new Date().toISOString(),
		};
	}

	@bindThis
	public renderDocument(file: MiDriveFile): IApDocument {
		return {
			type: 'Document',
			mediaType: file.webpublicType ?? file.type,
			url: this.driveFileEntityService.getPublicUrl(file, undefined, true),
			name: file.comment,
			sensitive: file.isSensitive,
		};
	}

	@bindThis
	public renderEmoji(emoji: MiEmoji): IApEmoji {
		return {
			id: `${this.config.url}/emojis/${emoji.name}`,
			type: 'Emoji',
			name: `:${emoji.name}:`,
			updated: emoji.updatedAt != null ? emoji.updatedAt.toISOString() : new Date().toISOString(),
			icon: {
				type: 'Image',
				mediaType: emoji.type ?? 'image/png',
				// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
				url: emoji.publicUrl || emoji.originalUrl,
			},
			_misskey_license: {
				freeText: emoji.license,
			},
			keywords: emoji.aliases,
			isSensitive: emoji.isSensitive,
			...(emoji.copyPermission === null ? { } : { copyPermission: emoji.copyPermission }),
			...(emoji.category === null ? { } : { category: emoji.category }),
			...(emoji.license === null ? { } : { license: emoji.license }),
			...(emoji.usageInfo === null ? { } : { usageInfo: emoji.usageInfo }),
			...(emoji.author === null ? { } : {
				author: emoji.author,
				creator: emoji.author,
			}),
			...(emoji.description === null ? { } : { description: emoji.description }),
			...(emoji.isBasedOn === null ? { } : { isBasedOn: emoji.isBasedOn }),
		};
	}

	// to anonymise reporters, the reporting actor must be a system user
	@bindThis
	public renderFlag(user: MiLocalUser, object: IObject | string, content: string): IFlag {
		return {
			type: 'Flag',
			actor: this.userEntityService.genLocalUserUri(user.id),
			content,
			object,
		};
	}

	@bindThis
	public renderFollowRelay(relay: MiRelay, relayActor: MiLocalUser): IFollow {
		return {
			id: `${this.config.url}/activities/follow-relay/${relay.id}`,
			type: 'Follow',
			actor: this.userEntityService.genLocalUserUri(relayActor.id),
			object: 'https://www.w3.org/ns/activitystreams#Public',
		};
	}

	/**
	 * Convert (local|remote)(Follower|Followee)ID to URL
	 * @param id Follower|Followee ID
	 */
	@bindThis
	public async renderFollowUser(id: MiUser['id']): Promise<string> {
		const user = await this.usersRepository.findOneByOrFail({ id: id }) as MiPartialLocalUser | MiPartialRemoteUser;
		return this.userEntityService.getUserUri(user);
	}

	@bindThis
	public renderFollow(
		follower: MiPartialLocalUser | MiPartialRemoteUser,
		followee: MiPartialLocalUser | MiPartialRemoteUser,
		requestId?: string,
	): IFollow {
		return {
			id: requestId ?? `${this.config.url}/follows/${follower.id}/${followee.id}`,
			type: 'Follow',
			actor: this.userEntityService.getUserUri(follower),
			object: this.userEntityService.getUserUri(followee),
		};
	}

	@bindThis
	public renderHashtag(tag: string): IApHashtag {
		return {
			type: 'Hashtag',
			href: `${this.config.url}/tags/${encodeURIComponent(tag)}`,
			name: `#${tag}`,
		};
	}

	@bindThis
	public renderImage(file: MiDriveFile): IApImage {
		return {
			type: 'Image',
			url: this.driveFileEntityService.getPublicUrl(file, undefined, true),
			sensitive: file.isSensitive,
			name: file.comment,
		};
	}

	@bindThis
	public renderKey(user: MiLocalUser, key: MiUserKeypair, postfix?: string): IKey {
		return {
			id: `${this.config.url}/users/${user.id}${postfix ?? '/publickey'}`,
			type: 'Key',
			owner: this.userEntityService.genLocalUserUri(user.id),
			publicKeyPem: createPublicKey(key.publicKey).export({
				type: 'spki',
				format: 'pem',
			}),
		};
	}

	@bindThis
	public async renderLike(noteReaction: MiNoteReaction, note: { uri: string | null }): Promise<ILike> {
		const reaction = noteReaction.reaction;

		const object: ILike = {
			type: 'Like',
			id: `${this.config.url}/likes/${noteReaction.id}`,
			actor: `${this.config.url}/users/${noteReaction.userId}`,
			object: note.uri ? note.uri : `${this.config.url}/notes/${noteReaction.noteId}`,
			content: reaction,
			_misskey_reaction: reaction,
		};

		if (reaction.startsWith(':')) {
			const name = reaction.replaceAll(':', '');
			const emoji = (await this.customEmojiService.localEmojisCache.fetch()).get(name);

			if (emoji && !emoji.localOnly) object.tag = [this.renderEmoji(emoji)];
		}

		return object;
	}

	@bindThis
	public renderMention(mention: MiPartialLocalUser | MiPartialRemoteUser): IApMention {
		return {
			type: 'Mention',
			href: this.userEntityService.getUserUri(mention),
			name: this.userEntityService.isRemoteUser(mention) ? `@${mention.username}@${mention.host}` : `@${(mention as MiLocalUser).username}`,
		};
	}

	@bindThis
	public renderMove(
		src: MiPartialLocalUser | MiPartialRemoteUser,
		dst: MiPartialLocalUser | MiPartialRemoteUser,
	): IMove {
		const actor = this.userEntityService.getUserUri(src);
		const target = this.userEntityService.getUserUri(dst);
		return {
			id: `${this.config.url}/moves/${src.id}/${dst.id}`,
			actor,
			type: 'Move',
			object: actor,
			target,
		};
	}

	@bindThis
	public renderClip(clip: MiClip): IClip {
		const rendered = {
			type: 'Clip',
			id: `${this.config.url}/clips/${clip.id}`,
			first: `${this.config.url}/clips/${clip.id}?page=true`,
			last: `${this.config.url}/clips/${clip.id}?page=true&since_id=000000000000000000000000`,
			name: clip.name,
			published: this.idService.parse(clip.id).date.toISOString(),
			to: ['https://www.w3.org/ns/activitystreams#Public'],
			cc: [`${this.config.url}/users/${clip.userId}/followers`],
			updated: clip.lastClippedAt?.toISOString() ?? undefined,
		} as IClip;

		if (clip.description) {
			let noMisskeySummary = false;
			const parsed_description = mfm.parse(clip.description);
			if (parsed_description.every(n => ['text', 'unicodeEmoji', 'emojiCode', 'mention', 'hashtag', 'url'].includes(n.type))) {
				noMisskeySummary = true;
			}
			rendered.summary = this.mfmService.toHtml(parsed_description) ?? undefined;
			if (!rendered.summary || !noMisskeySummary) {
				rendered._misskey_summary = clip.description;
			}
		}
		return rendered;
	}
	@bindThis
	public async renderNote(note: MiNote, dive = true, isTalk = false): Promise<IPost> {
		const getPromisedFiles = async (ids: string[]): Promise<MiDriveFile[]> => {
			if (ids.length === 0) return [];
			const items = await this.driveFilesRepository.findBy({ id: In(ids) });
			return ids.map(id => items.find(item => item.id === id)).filter(x => x != null);
		};

		let inReplyTo;
		let inReplyToNote: MiNote | null;

		if (note.replyId) {
			inReplyToNote = await this.notesRepository.findOneBy({ id: note.replyId });

			if (inReplyToNote != null) {
				const inReplyToUserExist = await this.usersRepository.exists({ where: { id: inReplyToNote.userId } });

				if (inReplyToUserExist) {
					if (inReplyToNote.uri) {
						inReplyTo = inReplyToNote.uri;
					} else {
						if (dive) {
							inReplyTo = await this.renderNote(inReplyToNote, false);
						} else {
							inReplyTo = `${this.config.url}/notes/${inReplyToNote.id}`;
						}
					}
				}
			}
		} else {
			inReplyTo = null;
		}

		let quote;

		if (note.renoteId) {
			const renote = await this.notesRepository.findOneBy({ id: note.renoteId });

			if (renote) {
				quote = renote.uri ? renote.uri : `${this.config.url}/notes/${renote.id}`;
			}
		}

		const attributedTo = this.userEntityService.genLocalUserUri(note.userId);

		const mentions = (JSON.parse(note.mentionedRemoteUsers) as IMentionedRemoteUsers).map(x => x.uri);

		let to: string[] = [];
		let cc: string[] = [];

		if (note.visibility === 'public') {
			to = ['https://www.w3.org/ns/activitystreams#Public'];
			cc = [`${attributedTo}/followers`].concat(mentions);
		} else if (note.visibility === 'home') {
			to = [`${attributedTo}/followers`];
			cc = ['https://www.w3.org/ns/activitystreams#Public'].concat(mentions);
		} else if (note.visibility === 'followers') {
			to = [`${attributedTo}/followers`];
			cc = mentions;
		} else {
			to = mentions;
		}
		let searchableBy: string[] | undefined = [];
		if (note.searchableBy === null) {
			searchableBy = undefined;
		} else	if (note.searchableBy === searchableTypes[0]) {
			searchableBy = ['https://www.w3.org/ns/activitystreams#Public'];
		} else if (note.searchableBy === searchableTypes[1]) {
			searchableBy = [`${this.config.url}/users/${note.userId}/followers`];
		} else if (note.searchableBy === searchableTypes[2]) {
			searchableBy = [`${this.config.url}/users/${note.userId}`];
		} else { // if (note.searchableBy === searchableTypes[3])
			searchableBy = ['as:Limited', 'kmyblue:Limited'];
		}
		const mentionedUsers = note.mentions.length > 0 ? await this.usersRepository.findBy({
			id: In(note.mentions),
		}) : [];

		const hashtagTags = note.tags.map(tag => this.renderHashtag(tag));
		const mentionTags = mentionedUsers.map(u => this.renderMention(u as MiLocalUser | MiRemoteUser));

		const files = await getPromisedFiles(note.fileIds);

		const text = note.text ?? '';
		let poll: MiPoll | null = null;

		if (note.hasPoll) {
			poll = await this.pollsRepository.findOneBy({ noteId: note.id });
		}

		let apAppend = '';

		if (quote) {
			apAppend += `\n\nRE: ${quote}`;
		}

		const summary = note.cw === '' ? String.fromCharCode(0x200B) : note.cw;

		const { content, noMisskeyContent } = this.apMfmService.getNoteHtml(note, apAppend);

		const emojis = await this.getEmojis(note.emojis);
		const apemojis = emojis.filter(emoji => !emoji.localOnly).map(emoji => this.renderEmoji(emoji));

		const tag = [
			...hashtagTags,
			...mentionTags,
			...apemojis,
		];

		const asPoll = poll ? {
			type: 'Question',
			[poll.expiresAt && poll.expiresAt < new Date() ? 'closed' : 'endTime']: poll.expiresAt,
			[poll.multiple ? 'anyOf' : 'oneOf']: poll.choices.map((text, i) => ({
				type: 'Note',
				name: text,
				replies: {
					type: 'Collection',
					totalItems: poll!.votes[i],
				},
			})),
		} as const : {};

		const asTalk = isTalk ? {
			_misskey_talk: true,
		} as const : {};

		let asEvent = {};
		if (note.hasEvent) {
			const event = await this.eventsRepository.findOneBy({ noteId: note.id });
			asEvent = event ? {
				type: 'Event',
				name: event.title,
				startTime: event.start,
				endTime: event.end,
				...event.metadata,
			} as const : {};
		}

		let asDeleteAt = {};
		if (note.deleteAt) {
			const n = await this.notesRepository.findOneBy({ id: note.id });
			asDeleteAt = n ? {
				deleteAt: n.deleteAt,
			} as const : {};
		}

		return {
			id: `${this.config.url}/notes/${note.id}`,
			type: 'Note',
			attributedTo,
			summary: summary ?? undefined,
			content: content ?? undefined,
			...(noMisskeyContent ? {} : {
				_misskey_content: text,
				source: {
					content: text,
					mediaType: 'text/x.misskeymarkdown',
				},
			}),
			_misskey_quote: quote,
			quoteUrl: quote,
			published: this.idService.parse(note.id).date.toISOString(),
			updated: note.updatedAt?.toISOString() ?? undefined,
			to,
			cc,
			...(searchableBy ? { searchableBy: searchableBy } : {}),
			inReplyTo,
			attachment: files.map(x => this.renderDocument(x)),
			sensitive: note.cw != null || files.some(file => file.isSensitive),
			tag,
			disableRightClick: note.disableRightClick,
			...asDeleteAt,
			...asEvent,
			...asPoll,
			...asTalk,
		};
	}

	@bindThis
	public async renderPerson(user: MiLocalUser) {
		const id = this.userEntityService.genLocalUserUri(user.id);
		const isSystem = user.username.includes('.');

		const [avatar, banner, profile] = await Promise.all([
			user.avatarId ? this.driveFilesRepository.findOneBy({ id: user.avatarId }) : undefined,
			user.bannerId ? this.driveFilesRepository.findOneBy({ id: user.bannerId }) : undefined,
			this.userProfilesRepository.findOneByOrFail({ userId: user.id }),
		]);

		const attachment_mutual_links = [];

		if (profile.mutualLinkSections.length > 0) {
			for (const section of profile.mutualLinkSections) {
				for (const entry of section.mutualLinks) {
					if (!section.name && !entry.url.length && !entry.description) continue;
					attachment_mutual_links.push({
						type: 'PropertyValue',
						name: section.name ?? '',
						value: (entry.url.startsWith('http://') || entry.url.startsWith('https://'))
							? `<a href="${new URL(entry.url).href}" rel="me nofollow noopener" target="_blank">${entry.description ?? new URL(entry.url).href}</a>`
							: entry.description ?? '',
					});
				}
			}
		}
		const attachment = attachment_mutual_links.concat(profile.fields.map(field => ({
			type: 'PropertyValue',
			name: field.name,
			value: (field.value.startsWith('http://') || field.value.startsWith('https://'))
				? `<a href="${new URL(field.value).href}" rel="me nofollow noopener" target="_blank">${new URL(field.value).href}</a>`
				: field.value,
		})));

		const emojis = await this.getEmojis(user.emojis);
		const apemojis = emojis.filter(emoji => !emoji.localOnly).map(emoji => this.renderEmoji(emoji));

		const hashtagTags = user.tags.map(tag => this.renderHashtag(tag));

		const tag = [
			...apemojis,
			...hashtagTags,
		];

		const keypair = await this.userKeypairService.getUserKeypair(user.id);
		const searchableByData = toSerchableByProperty(this.config.url, user.id, user.searchableBy);

		const person: any = {
			type: isSystem ? 'Application' : user.isBot ? 'Service' : 'Person',
			id,
			inbox: `${id}/inbox`,
			outbox: `${id}/outbox`,
			followers: `${id}/followers`,
			following: `${id}/following`,
			featured: `${id}/collections/featured`,
			sharedInbox: `${this.config.url}/inbox`,
			endpoints: { sharedInbox: `${this.config.url}/inbox` },
			url: `${this.config.url}/@${user.username}`,
			preferredUsername: user.username,
			name: user.name,
			summary: profile.description ? this.mfmService.toHtml(mfm.parse(profile.description)) : null,
			_misskey_summary: profile.description,
			_misskey_followedMessage: profile.followedMessage,
			_misskey_requireSigninToViewContents: user.requireSigninToViewContents,
			_misskey_makeNotesFollowersOnlyBefore: user.makeNotesFollowersOnlyBefore,
			_misskey_makeNotesHiddenBefore: user.makeNotesHiddenBefore,
			icon: avatar ? this.renderImage(avatar) : null,
			image: banner ? this.renderImage(banner) : null,
			tag,
			manuallyApprovesFollowers: user.isLocked,
			discoverable: user.isExplorable,
			indexable: user.isIndexable,
			...( searchableByData ? { searchableBy: searchableByData } : {}),
			publicKey: this.renderKey(user, keypair, '#main-key'),
			isCat: user.isCat,
			attachment: attachment.length ? attachment : undefined,
			setFederationAvatarShape: user.setFederationAvatarShape ?? undefined,
			isSquareAvatars: user.isSquareAvatars ?? undefined,
			_yojoart_clips: `${id}/collections/clips`,
		};

		if (user.movedToUri) {
			person.movedTo = user.movedToUri;
		}

		if (user.alsoKnownAs) {
			person.alsoKnownAs = user.alsoKnownAs;
		}

		if (profile.birthday) {
			person['vcard:bday'] = profile.birthday;
		}

		if (profile.location) {
			person['vcard:Address'] = profile.location;
		}

		if (profile.mutualLinkSections.length > 0) {
			const ApMutualLinkSections = await Promise.all(profile.mutualLinkSections.map(async section => {
				return {
					sectionName: section.name ? this.mfmService.toHtml(mfm.parse(section.name)) : null,
					_misskey_sectionName: section.name,
					entrys: await Promise.all(section.mutualLinks.map(async entry => {
						const img = await this.driveFilesRepository.findOneBy({ id: entry.fileId });
						return {
							description: entry.description ? this.mfmService.toHtml(mfm.parse(entry.description)) : null,
							_misskey_description: entry.description,
							image: img ? this.renderImage(img) : null,
							url: entry.url,
						};
					})),
				};
			}));
			person.banner = ApMutualLinkSections;
		}

		return person;
	}

	@bindThis
	public renderQuestion(user: { id: MiUser['id'] }, note: MiNote, poll: MiPoll): IQuestion {
		return {
			type: 'Question',
			id: `${this.config.url}/questions/${note.id}`,
			actor: this.userEntityService.genLocalUserUri(user.id),
			content: note.text ?? '',
			[poll.multiple ? 'anyOf' : 'oneOf']: poll.choices.map((text, i) => ({
				name: text,
				_misskey_votes: poll.votes[i],
				replies: {
					type: 'Collection',
					totalItems: poll.votes[i],
				},
			})),
		};
	}

	@bindThis
	public renderRead(user: { id: MiUser['id'] }, message: MiMessagingMessage): IRead {
		return {
			type: 'Read',
			actor: `${this.config.url}/users/${user.id}`,
			object: message.uri!,
		};
	}

	@bindThis
	public renderReject(object: string | IObject, user: { id: MiUser['id'] }): IReject {
		return {
			type: 'Reject',
			actor: this.userEntityService.genLocalUserUri(user.id),
			object,
		};
	}

	@bindThis
	public renderRemove(user: { id: MiUser['id'] }, target: string | IObject | undefined, object: string | IObject): IRemove {
		return {
			type: 'Remove',
			actor: this.userEntityService.genLocalUserUri(user.id),
			target,
			object,
		};
	}

	@bindThis
	public renderTombstone(id: string): ITombstone {
		return {
			id,
			type: 'Tombstone',
		};
	}

	@bindThis
	public renderUndo(object: string | IObject, user: { id: MiUser['id'] }): IUndo {
		const id = typeof object !== 'string' && typeof object.id === 'string' && this.utilityService.isUriLocal(object.id) ? `${object.id}/undo` : undefined;

		return {
			type: 'Undo',
			...(id ? { id } : {}),
			actor: this.userEntityService.genLocalUserUri(user.id),
			object,
			published: new Date().toISOString(),
		};
	}

	@bindThis
	public renderUpdate(object: string | IObject, user: { id: MiUser['id'] }): IUpdate {
		return {
			id: `${this.config.url}/users/${user.id}#updates/${new Date().getTime()}`,
			actor: this.userEntityService.genLocalUserUri(user.id),
			type: 'Update',
			to: ['https://www.w3.org/ns/activitystreams#Public'],
			object,
			published: new Date().toISOString(),
		};
	}

	@bindThis
	public renderVote(user: { id: MiUser['id'] }, vote: MiPollVote, note: MiNote, poll: MiPoll, pollOwner: MiRemoteUser): ICreate {
		return {
			id: `${this.config.url}/users/${user.id}#votes/${vote.id}/activity`,
			actor: this.userEntityService.genLocalUserUri(user.id),
			type: 'Create',
			to: [pollOwner.uri],
			published: new Date().toISOString(),
			object: {
				id: `${this.config.url}/users/${user.id}#votes/${vote.id}`,
				type: 'Note',
				attributedTo: this.userEntityService.genLocalUserUri(user.id),
				to: [pollOwner.uri],
				inReplyTo: note.uri,
				name: poll.choices[vote.choice],
			},
		};
	}

	@bindThis
	public addContext<T extends IObject>(x: T): T & { '@context': any; id: string; } {
		if (typeof x === 'object' && x.id == null) {
			x.id = `${this.config.url}/${randomUUID()}`;
		}

		return Object.assign({ '@context': CONTEXT }, x as T & { id: string });
	}

	@bindThis
	public async attachLdSignature(activity: any, user: { id: MiUser['id']; host: null; }): Promise<IActivity> {
		const keypair = await this.userKeypairService.getUserKeypair(user.id);

		const jsonLd = this.jsonLdService.use();
		jsonLd.debug = false;
		activity = await jsonLd.signRsaSignature2017(activity, keypair.privateKey, `${this.config.url}/users/${user.id}#main-key`);

		return activity;
	}

	/**
	 * Render OrderedCollectionPage
	 * @param id URL of self
	 * @param totalItems Number of total items
	 * @param orderedItems Items
	 * @param partOf URL of base
	 * @param prev URL of prev page (optional)
	 * @param next URL of next page (optional)
	 */
	@bindThis
	public renderOrderedCollectionPage(id: string, totalItems: any, orderedItems: any, partOf: string, prev?: string, next?: string) {
		const page: any = {
			id,
			partOf,
			type: 'OrderedCollectionPage',
			totalItems,
			orderedItems,
		};

		if (prev) page.prev = prev;
		if (next) page.next = next;

		return page;
	}

	/**
	 * Render OrderedCollection
	 * @param id URL of self
	 * @param totalItems Total number of items
	 * @param first URL of first page (optional)
	 * @param last URL of last page (optional)
	 * @param orderedItems attached objects (optional)
	 */
	@bindThis
	public renderOrderedCollection(id: string | null, totalItems: number, first?: string, last?: string, orderedItems?: IObject[]) {
		const page: any = {
			id,
			type: 'OrderedCollection',
			totalItems,
		};

		if (first) page.first = first;
		if (last) page.last = last;
		if (orderedItems) page.orderedItems = orderedItems;

		return page;
	}

	@bindThis
	private async getEmojis(names: string[]): Promise<MiEmoji[]> {
		if (names.length === 0) return [];

		const allEmojis = await this.customEmojiService.localEmojisCache.fetch();
		const emojis = names.map(name => allEmojis.get(name)).filter(x => x != null);

		return emojis;
	}

	@bindThis
	public async renderReversiInvite(game_session_id:string, invite_from:MiUser, invite_to:MiRemoteUser, invite_date:Date): Promise<IInvite> {
		const game:IApReversi = {
			type: 'Game',
			game_type_uuid: '1c086295-25e3-4b82-b31e-3e3959906312',
			extent_flags: [],
			game_state: {
				game_session_id,
			},
		};
		const activity: IInvite = {
			id: `${this.config.url}/games/${game.game_type_uuid}/${game_session_id}/activity`,
			actor: this.userEntityService.genLocalUserUri(invite_from.id),
			type: 'Invite',
			published: invite_date.toISOString(),
			object: game,
		};
		activity.to = invite_to.uri;
		activity.cc = [];

		return activity;
	}

	@bindThis
	public async renderReversiJoin(game_session_id:string, join_user:MiUser, invite_from:MiRemoteUser, join_date:Date): Promise<IJoin> {
		const game:IApReversi = {
			type: 'Game',
			game_type_uuid: '1c086295-25e3-4b82-b31e-3e3959906312',
			extent_flags: [],
			game_state: {
				game_session_id,
			},
		};
		const activity: IJoin = {
			id: `${this.config.url}/games/${game.game_type_uuid}/${game_session_id}/activity`,
			actor: this.userEntityService.genLocalUserUri(join_user.id),
			type: 'Join',
			published: join_date.toISOString(),
			object: game,
		};
		activity.to = invite_from.uri;
		activity.cc = [];

		return activity;
	}

	@bindThis
	public async renderReversiUpdate(local_user:MiUser, remote_user:MiRemoteUser,
		game_state: {
			game_session_id: string;
			type: string;
			pos?: number;//石配置
			key?: string;//設定変更
			value?: any;//設定変更
			ready?: boolean;//ゲーム開始
		},
	) {
		const game:IApReversi = {
			type: 'Game',
			game_type_uuid: '1c086295-25e3-4b82-b31e-3e3959906312',
			extent_flags: [],
			game_state,
		};
		const activity: IUpdate = {
			type: 'Update',
			actor: this.userEntityService.genLocalUserUri(local_user.id),
			object: game,
		};
		activity.to = remote_user.uri;
		activity.cc = [];

		return activity;
	}

	@bindThis
	public async renderReversiLeave(local_user: MiUser, remote_user: MiRemoteUser, game_state: { game_session_id: string; }) {
		const game:IApReversi = {
			type: 'Game',
			game_type_uuid: '1c086295-25e3-4b82-b31e-3e3959906312',
			extent_flags: [],
			game_state,
		};
		const activity: ILeave = {
			type: 'Leave',
			actor: this.userEntityService.genLocalUserUri(local_user.id),
			object: game,
		};
		activity.to = remote_user.uri;
		activity.cc = [];

		return activity;
	}
	@bindThis
	public async renderReversiLike(game_session_id:string, reaction:string, reaction_from:MiUser, reaction_to:MiRemoteUser): Promise<ILike> {
		const url = new URL(reaction_to.uri).origin;
		const activity: ILike = {
			object: `${url}/games/1c086295-25e3-4b82-b31e-3e3959906312/${game_session_id}`,
			actor: this.userEntityService.genLocalUserUri(reaction_from.id),
			type: 'EmojiReaction',
			published: new Date().toISOString(),
			content: reaction,
			_misskey_reaction: reaction,
		};
		activity.to = reaction_to.uri;
		activity.cc = [];

		if (reaction.startsWith(':')) {
			const name = reaction.replaceAll(':', '');
			const emoji = (await this.customEmojiService.localEmojisCache.fetch()).get(name);

			if (emoji && !emoji.localOnly) activity.tag = [this.renderEmoji(emoji)];
		}
		return activity;
	}
}
