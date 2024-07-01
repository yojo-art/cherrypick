/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Entity, Index, Column, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';

@Entity('official_tag')
export class MiOfficialTag {
	@PrimaryColumn(id())
	public id: string;
	@Index()
	@Column('varchar', {
		length: 126, nullable: false, unique: true,
	})
	public name: string;

	@Column('varchar', {
		length: 1024, nullable: true,
	})
	public description: string | null;

	@Column('varchar', {
		length: 1024, nullable: true,
	})
	public bannerUrl: string | null;

	@Column('integer', {
		default: 100, nullable: false,
	})
	public priority: number;

	constructor(data: Partial<MiOfficialTag>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}
