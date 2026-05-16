/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, JoinColumn, Column, OneToOne } from 'typeorm';
import { id } from './util/id.js';
import { MiChannel } from './Channel.js';

@Entity('channel_keypair')
export class MiChannelKeypair {
	@PrimaryColumn(id())
	public channelId: MiChannel['id'];

	@OneToOne(type => MiChannel, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiChannel | null;

	@Column('varchar', {
		length: 4096,
	})
	public publicKey: string;

	@Column('varchar', {
		length: 4096,
	})
	public privateKey: string;

	constructor(data: Partial<MiChannelKeypair>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}
