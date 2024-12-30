/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { EmojisRepository } from '@/models/_.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import { DI } from '@/di-symbols.js';
import { DriveService } from '@/core/DriveService.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { emojiCopyPermissions } from '@/types.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
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
		copyIsNotAllowed: {
			message: 'Copy is not allowed this emoji.',
			code: 'NOT_ALLOWED',
			id: '1beadfcc-3882-f3c9-ee57-ded45e4741e4',
		},
		seeUsageInfoAndLicense: {
			message: 'see Usage information or license.',
			code: 'SEE_USAGEINFOMATION_OR_LICENSE',
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
		emojiId: { type: 'string', format: 'misskey:id' },
		usageInfoReaded: {
			type: 'boolean',
		},
	},
	required: ['emojiId'],
} as const;

// TODO: ロジックをサービスに切り出す

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,
		private emojiEntityService: EmojiEntityService,
		private customEmojiService: CustomEmojiService,
		private driveService: DriveService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const emoji = await this.emojisRepository.findOneBy({ id: ps.emojiId });
			if (emoji == null) {
				throw new ApiError(meta.errors.noSuchEmoji);
			}

			//コピー拒否
			if (emoji.copyPermission === emojiCopyPermissions[1]) throw new ApiError(meta.errors.copyIsNotAllowed);
			//条件付き
			const readed = ps.usageInfoReaded ?? false;
			if (emoji.copyPermission === emojiCopyPermissions[2] && !readed) throw new ApiError(meta.errors.seeUsageInfoAndLicense);

			let driveFile: MiDriveFile;

			try {
				// Create file
				driveFile = await this.driveService.uploadFromUrl({ url: emoji.originalUrl, user: null, force: false });
			} catch (e) {
				// TODO: need to return Drive Error
				throw new ApiError();
			}

			// Duplication Check
			const isDuplicate = await this.customEmojiService.checkDuplicate(emoji.name);
			if (isDuplicate) throw new ApiError(meta.errors.duplicateName);

			const addedEmoji = await this.customEmojiService.add({
				driveFile,
				name: emoji.name,
				category: emoji.category,
				aliases: emoji.aliases,
				host: null,
				license: emoji.license,
				isSensitive: emoji.isSensitive,
				localOnly: emoji.localOnly,
				roleIdsThatCanBeUsedThisEmojiAsReaction: emoji.roleIdsThatCanBeUsedThisEmojiAsReaction,
				copyPermission: emoji.copyPermission,
				usageInfo: emoji.usageInfo,
				author: emoji.author,
				description: emoji.description,
			}, me);

			return this.emojiEntityService.packDetailed(addedEmoji);
		});
	}
}
