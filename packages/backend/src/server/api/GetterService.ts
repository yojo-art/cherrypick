/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { NotesRepository, UsersRepository, UserProfilesRepository, MessagingMessagesRepository, MiMessagingMessage } from '@/models/_.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { MiLocalUser, MiRemoteUser, MiUser } from '@/models/User.js';
import type { MiUserProfile } from '@/models/UserProfile.js';
import type { MiNote } from '@/models/Note.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class GetterService {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,

		@Inject(DI.messagingMessagesRepository)
		private messagingMessagesRepository: MessagingMessagesRepository,
	) {
	}

	/**
	 * Get note for API processing
	 */
	@bindThis
	public async getNote(noteId: MiNote['id']) {
		const note = await this.notesRepository.findOneBy({ id: noteId });

		if (note == null) {
			throw new IdentifiableError('9725d0ce-ba28-4dde-95a7-2cbb2c15de24', 'No such note.');
		}

		return note;
	}

	/**
	 * Get user for API processing
	 */
	@bindThis
	public async getUser(userId: MiUser['id']) {
		const user = await this.usersRepository.findOneBy({ id: userId });

		if (user == null) {
			throw new IdentifiableError('15348ddd-432d-49c2-8a5a-8069753becff', 'No such user.');
		}

		return user as MiLocalUser | MiRemoteUser;
	}

	/**
	 * Get remote user for API processing
	 */
	@bindThis
	public async getRemoteUser(userId: MiUser['id']) {
		const user = await this.getUser(userId);

		if (!this.userEntityService.isRemoteUser(user)) {
			throw new Error('user is not a remote user');
		}

		return user;
	}

	/**
	 * Get local user for API processing
	 */
	@bindThis
	public async getLocalUser(userId: MiUser['id']) {
		const user = await this.getUser(userId);

		if (!this.userEntityService.isLocalUser(user)) {
			throw new Error('user is not a local user');
		}

		return user;
	}

	@bindThis
	public async getUserProfiles(userId: MiUserProfile['userId']) {
		const user = await this.userProfilesRepository.findOneBy({ userId: userId });

		if (user == null) {
			throw new IdentifiableError('15348ddd-432d-49c2-8a5a-8069753becff', 'No such user.');
		}

		return user;
	}

	/**
	 * Get message for API processing
	 */

	@bindThis
	public async getMessages(messageId: MiMessagingMessage['id']) {
		const messages = await this.messagingMessagesRepository.findOneBy({ id: messageId });

		if (messages == null) {
			throw new IdentifiableError('bfdbac90-f762-11ee-9c67-00155d403610', 'No such message.');
		}

		return messages;
	}
}

