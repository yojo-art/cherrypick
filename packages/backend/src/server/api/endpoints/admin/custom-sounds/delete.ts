/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { CustomSoundService } from '@/core/CustomSoundService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requiredRolePolicy: 'canManageCustomSounds',
	kind: 'write:admin:custom-sounds',

	errors: {
		noSuchSound: {
			message: 'No such sound.',
			code: 'NO_SUCH_SOUND',
			id: '9ec39198-241a-49f3-9efb-f74b22fdb8c9',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', format: 'misskey:id' },
	},
	required: ['id'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private customSoundService: CustomSoundService,
	) {
		super(meta, paramDef, async (ps) => {
			const sound = await this.customSoundService.findOneById(ps.id);
			if (sound == null) {
				throw new ApiError(meta.errors.noSuchSound);
			}

			await this.customSoundService.delete(ps.id);
		});
	}
}
