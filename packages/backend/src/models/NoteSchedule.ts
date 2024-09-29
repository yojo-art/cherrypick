/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Entity, Index, JoinColumn, Column, PrimaryColumn, ManyToOne } from 'typeorm';
import { noteVisibilities } from '@/types.js';
import { MiNote } from '@/models/Note.js';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiChannel } from './Channel.js';
import type { MiDriveFile } from './DriveFile.js';

@Entity('note_schedule')
export class MiNoteSchedule {
	@PrimaryColumn(id())
	public id: string;

	@Column('jsonb')
	public note:{
		id: MiNote['id'];
		apEmojis?: any[];
		visibility: 'public' | 'home' | 'followers' | 'specified';
		apMentions?: any[];
		visibleUsers: MiUser[];
		channel: null | MiChannel;
		poll: {
			multiple: boolean;
			choices: string[];
			expiresAt: Date | null
		} | undefined;
		renote: null | MiNote;
		localOnly: boolean;
		cw?: string|null;
		apHashtags?: string[];
		reactionAcceptance: 'likeOnly'|'likeOnlyForRemote'| 'nonSensitiveOnly'| 'nonSensitiveOnlyForLocalLikeOnlyForRemote'| null;
		files: MiDriveFile[];
		text: string;
		reply: null | MiNote
	};

	@Index()
	@Column('varchar', {
		length: 260,
	})
	public userId: MiUser['id'];

	@Column('timestamp with time zone')
	public expiresAt: Date;
}
