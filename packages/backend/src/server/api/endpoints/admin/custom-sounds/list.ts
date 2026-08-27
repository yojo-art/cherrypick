/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { CustomSoundService } from '@/core/CustomSoundService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requiredRolePolicy: 'canManageCustomSounds',
	kind: 'read:admin:custom-sounds',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
				},
				name: {
					type: 'string',
					optional: false, nullable: false,
				},
				driveFile: {
					type: 'string',
					optional: false, nullable: true,
					format: 'id',
				},
				url: {
					type: 'string',
					optional: false, nullable: true,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private customSoundService: CustomSoundService,
	) {
		super(meta, paramDef, async () => {
			const sounds = await this.customSoundService.getAll();

			return await this.customSoundService.packMany(sounds);
		});
	}
}
