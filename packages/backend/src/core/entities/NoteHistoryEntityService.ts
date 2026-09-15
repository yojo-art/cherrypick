/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DI } from '@/di-symbols.js';
import type { Packed } from '@/misc/json-schema.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { MiUser } from '@/models/User.js';
import type { MiNote } from '@/models/Note.js';
import type { UsersRepository, NotesRepository, FollowingsRepository, PollsRepository, PollVotesRepository, NoteReactionsRepository, ChannelsRepository, NoteHistoryRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { DebounceLoader } from '@/misc/loader.js';
import { shouldHideNoteByTime } from '@/misc/should-hide-note-by-time.js';
import { IdService } from '@/core/IdService.js';
import { NoteHistory } from '@/models/NoteHistory.js';
import type { OnModuleInit } from '@nestjs/common';
import type { CustomEmojiService } from '../CustomEmojiService.js';
import type { UserEntityService } from './UserEntityService.js';
import type { DriveFileEntityService } from './DriveFileEntityService.js';

@Injectable()
export class NoteHistoryEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private driveFileEntityService: DriveFileEntityService;
	private customEmojiService: CustomEmojiService;
	private idService: IdService;
	private historyLoader = new DebounceLoader(this.findNoteHistoryOrFail);

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.noteHistoryRepository)
		private noteHistoryRepository: NoteHistoryRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		//private userEntityService: UserEntityService,
		//private driveFileEntityService: DriveFileEntityService,
		//private customEmojiService: CustomEmojiService,
		//private reactionService: ReactionService,
	) {
	}

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.driveFileEntityService = this.moduleRef.get('DriveFileEntityService');
		this.customEmojiService = this.moduleRef.get('CustomEmojiService');
		this.idService = this.moduleRef.get('IdService');
	}

	@bindThis
	public async packAttachedFiles(fileIds: NoteHistory['fileIds'], packedFiles: Map<NoteHistory['fileIds'][number], Packed<'DriveFile'> | null>): Promise<Packed<'DriveFile'>[]> {
		const missingIds = [];
		for (const id of fileIds) {
			if (!packedFiles.has(id)) missingIds.push(id);
		}
		if (missingIds.length) {
			const additionalMap = await this.driveFileEntityService.packManyByIdsMap(missingIds);
			for (const [k, v] of additionalMap) {
				packedFiles.set(k, v);
			}
		}
		return fileIds.map(id => packedFiles.get(id)).filter(x => x != null);
	}

	@bindThis
	private async pack(
		src: NoteHistory['id'],
		host: MiNote['userHost'],
		options?: {
			_hint_?: {
				packedFiles: Map<NoteHistory['fileIds'][number], Packed<'DriveFile'> | null>;
			};
		},
	): Promise<Packed<'NoteHistory'>> {
		const history = await this.historyLoader.load(src);

		const text = history.text;
		const packedFiles = options?._hint_?.packedFiles;

		const packed: Packed<'NoteHistory'> = await awaitAll({
			id: history.id,
			noteId: history.noteId,
			createdAt: history.createdAt.toISOString(),
			updatedAt: history.updatedAt.toISOString(),
			userId: history.userId,
			text: text,
			cw: history.cw ?? undefined,
			poll: history.poll ? {
				choices: history.poll.choices,
				multiple: history.poll.multiple,
				expiresAt: history.poll.expiresAt ? new Date(history.poll.expiresAt).toISOString() : null,
			} : undefined,
			event: history.event ? {
				title: history.event.title,
				start: new Date(history.event.start).toISOString(),
				end: history.event.end ? new Date(history.event.end).toISOString() : null,
				metadata: history.event.metadata,
			} : undefined,
			visibility: history.visibility,
			visibleUserIds: history.visibility === 'specified' ? history.visibleUserIds : undefined,
			emojis: host != null ? this.customEmojiService.populateEmojis(history.emojis, host) : undefined,
			fileIds: history.fileIds,
			files: packedFiles != null ? this.packAttachedFiles(history.fileIds, packedFiles) : this.driveFileEntityService.packManyByIds(history.fileIds),
		});

		return packed;
	}

	@bindThis
	public async packMany (
		histories: NoteHistory[],
		note: MiNote,
		me?: MiUser | null,
	): Promise<Packed<'NoteHistory'>[]> {
		if (histories.length === 0) return [];

		// NoteHistory.userId は recordHistory で originalNote.userId から設定され、
		// notes/update は他人のノートの編集を拒否するため、同一ノートの履歴の作者は全件ノート作者と一致する。
		const author = note.user ?? await this.usersRepository.findOneBy({ id: note.userId });

		const packed: Packed<'NoteHistory'>[] = [];
		const meId = me?.id ?? null;
		let isFollowingAuthor: boolean | null = null;
		const checkFollowingAuthor = async (): Promise<boolean> => {
			if (isFollowingAuthor != null) return isFollowingAuthor;
			if (meId == null) return false;
			isFollowingAuthor = await this.followingsRepository.exists({
				where: {
					followeeId: note.userId,
					followerId: meId,
				},
			});
			return isFollowingAuthor;
		};
		for (const history of histories) {
			const packed_history = await this.pack(history.id, note.userHost);
			const isVisibleForMe = await this.isVisible(packed_history, meId, author, note, checkFollowingAuthor);
			if (isVisibleForMe) {
				packed.push(packed_history);
			}
		}
		return packed;
	}

	@bindThis
	private findNoteHistoryOrFail(id: string): Promise<NoteHistory> {
		return this.noteHistoryRepository.findOneOrFail({
			where: { id },
		});
	}

	@bindThis
	private async isVisible(
		packedHistory: Packed<'NoteHistory'>,
		meId: MiUser['id'] | null,
		author: MiUser | null,
		note: MiNote,
		checkFollowingAuthor: () => Promise<boolean>,
	): Promise<boolean> {
		if (packedHistory.userId === meId) {
			return true;
		}

		// makeNotesHiddenBefore / makeNotesFollowersOnlyBefore は「ノートが古いか」で判定するため、
		// ノートの作成時刻（=IDに埋め込まれた時刻。編集しても変わらない）を基準にする。
		const noteCreatedAt = this.idService.parse(note.id).date;

		if (author != null) {
			if (author.requireSigninToViewContents && meId == null) {
				return false;
			}
			if (shouldHideNoteByTime(author.makeNotesHiddenBefore, noteCreatedAt)) {
				return false;
			}
		}

		let visibility = packedHistory.visibility;
		if (
			(visibility === 'public' || visibility === 'home') &&
			author != null &&
			shouldHideNoteByTime(author.makeNotesFollowersOnlyBefore, noteCreatedAt)
		) {
			visibility = 'followers';
		}

		if (visibility === 'specified') {
			if (meId == null) {
				return false;
			}
			return packedHistory.visibleUserIds?.some((id: string) => meId === id) ?? false;
		}

		if (visibility === 'followers') {
			if (meId == null) {
				return false;
			}
			if (note.replyUserId != null && meId === note.replyUserId) {
				// 自分の投稿に対するリプライ
				return true;
			}
			if (note.mentions.some((id: string) => meId === id)) {
				// 自分へのメンション
				return true;
			}
			return await checkFollowingAuthor();
		}

		return true;
	}
}
