/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, Index, Column } from 'typeorm';
import { id } from './util/id.js';
import { emojiCopyPermissions } from "@/types.js";

@Entity('emoji')
@Index(['name', 'host'], { unique: true })
export class MiEmoji {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public updatedAt: Date | null;

	@Index()
	@Column('varchar', {
		length: 128,
	})
	public name: string;

	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
	})
	public host: string | null;

	@Column('varchar', {
		length: 128, nullable: true,
	})
	public category: string | null;

	@Column('varchar', {
		length: 512,
	})
	public originalUrl: string;

	@Column('varchar', {
		length: 512,
		default: '',
	})
	public publicUrl: string;

	@Column('varchar', {
		length: 512, nullable: true,
	})
	public uri: string | null;

	// publicUrlの方のtypeが入る
	@Column('varchar', {
		length: 64, nullable: true,
	})
	public type: string | null;

	@Column('varchar', {
		array: true, length: 128, default: '{}',
	})
	public aliases: string[];

	@Column('varchar', {
		length: 1024, nullable: true,
	})
	public license: string | null;

	@Column('boolean', {
		default: false,
	})
	public localOnly: boolean;

	@Column('boolean', {
		default: false,
	})
	public isSensitive: boolean;

	@Column('varchar', {
		length: 512,
		default: null,
		nullable: true,
	})
	public usageInfo: string | null;

	@Column('varchar', {
		length: 512,
		default: null,
		nullable: true,
	})
	public description: string | null;

	@Column('varchar', {
		length: 128,
		default: null,
		nullable: true,
	})
	public author: string | null;

	@Column('enum',
		{
			enum: emojiCopyPermissions,
			nullable: true,
		})
	public copyPermission: typeof emojiCopyPermissions[number] | null;

	@Column('varchar', {
		length: 1024,
		default: null,
	})
	public isBasedOn: string | null;

	// TODO: 定期ジョブで存在しなくなったロールIDを除去するようにする
	@Column('varchar', {
		array: true, length: 128, default: '{}',
	})
	public roleIdsThatCanBeUsedThisEmojiAsReaction: string[];
}
