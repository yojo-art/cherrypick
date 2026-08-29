/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Entity, Index, JoinColumn, Column, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiNote } from './Note.js';

@Entity('quote_authorization')
export class MiQuoteAuthorization {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The note ID.',
	})
	public noteId: MiNote['id'];

	@ManyToOne(() => MiNote, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: MiNote | null;

	@Index({ unique: true })
	@Column('varchar', {
		length: 255,
		comment: 'The QuoteAuthorization token.',
	})
	public token: string;

	@Column('varchar', {
		length: 4096,
		comment: 'The URI of the object interacting with the note (the quoting object).',
	})
	public interactingObject: string;
}
