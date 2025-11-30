/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { ApiError } from '../../../error.js';
import { IdentifiableError } from "@/misc/identifiable-error.js";

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requiredRolePolicy: 'canManageCustomEmojis',
	kind: 'write:admin:emoji',

	errors: {
		noSuchEmoji: {
			message: 'No such emoji.',
			code: 'NO_SUCH_EMOJI',
			id: 'e2785b66-dca3-4087-9cac-b93c541cc425',
		},
		duplicateName: {
			message: 'Duplicate name.',
			code: 'DUPLICATE_NAME',
			id: 'f7a3462c-4e6e-4069-8421-b9bd4f4c3975',
		},
		localEmojiAlreadyExists: {
			message: 'Local emoji already exists.',
			code: 'LOCAL_EMOJI_ALREADY_EXISTS',
			id: 'c7262375-102c-41c6-be6b-4f81166a8a5b',
		},
		copyIsNotAllowed: {
			message: 'Copy is not allowed this emoji.',
			code: 'NOT_ALLOWED',
			id: '1beadfcc-3882-f3c9-ee57-ded45e4741e4',
		},
		seeLicense: {
			message: 'see license.',
			code: 'SEE_LICENSE',
			id: '28d9031e-ddbc-5ba3-c435-fcb5259e8408',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			id: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string' },
		host: { type: 'string' },
		licenseReadText: { type: 'string', nullable: true, default: null },
	},
	required: ['name', 'host'],
} as const;

// TODO: ロジックをサービスに切り出す

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		private emojiEntityService: EmojiEntityService,
		private customEmojiService: CustomEmojiService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const imported = await this.customEmojiService.importEmoji({
					name: ps.name,
					host: ps.host,
					licenseReadText: ps.licenseReadText
				}, me);
				return this.emojiEntityService.packDetailed(imported);
			} catch (err) {
				if (err instanceof IdentifiableError) {
					if (err.id === '1bdcb17b-76de-4a33-8b5e-2649f6fe3f1e') throw new ApiError(meta.errors.noSuchEmoji);
					if (err.id === '16bd0f1d-c797-468e-af3f-a7eede1fef72') throw new ApiError(meta.errors.copyIsNotAllowed);
					if (err.id === '064ac9f8-5531-4e9b-b158-3cf8524d96ef') throw new ApiError(meta.errors.seeLicense);
					if (err.id === '141c2c9af-0039-45e8-a99b-bc9027f4e0a9') throw new ApiError(meta.errors.duplicateName);
					throw new ApiError();
				}
				throw new ApiError();
			}
		});
	}
}
