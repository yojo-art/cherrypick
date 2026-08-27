/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Entity, PrimaryColumn, Column, Index } from 'typeorm';
import { id } from './util/id.js';

@Entity('custom_sound')
export class MiCustomSound {
	@PrimaryColumn(id())
	public id: string;

	@Column('varchar', {
		length: 256,
	})
	public name: string;

	@Index('IDX_custom_sound_file_id', { unique: true })
	@Column({
		...id(),
		nullable: true,
	})
	public fileId: string | null;
}
