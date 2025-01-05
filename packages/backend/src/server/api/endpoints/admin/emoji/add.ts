/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { DriveFilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
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
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'fc46b5a4-6b92-4c33-ac66-b806659bb5cf',
		},
		duplicateName: {
			message: 'Duplicate name.',
			code: 'DUPLICATE_NAME',
			id: 'f7a3462c-4e6e-4069-8421-b9bd4f4c3975',
		},
	},

	res: {
		type: 'object',
		ref: 'EmojiDetailed',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', pattern: '^[a-zA-Z0-9_]+$' },
		fileId: { type: 'string', format: 'misskey:id' },
		category: {
			type: 'string',
			nullable: true,
			description: 'Use `null` to reset the category.',
		},
		aliases: { type: 'array', items: {
			type: 'string',
		} },
		license: { type: 'string', nullable: true },
		isSensitive: { type: 'boolean' },
		localOnly: { type: 'boolean' },
		roleIdsThatCanBeUsedThisEmojiAsReaction: { type: 'array', items: {
			type: 'string',
		} },

		copyPermission: { type: 'string', enum: emojiCopyPermissions, nullable: true, default: emojiCopyPermissions[0], description: 'この絵文字を外部サーバーへコピーすることの許可' },
		usageInfo: { type: 'string', nullable: true, description: '使用する際の説明' },
		author: { type: 'string', nullable: true, description: '作者情報' },
		description: { type: 'string', nullable: true, description: '絵文字の説明' },
		isBasedOn: { type: 'string', nullable: true, description: 'もとになったもののURLなど' },
	},
	required: ['name', 'fileId'],
} as const;

// TODO: ロジックをサービスに切り出す

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private customEmojiService: CustomEmojiService,

		private emojiEntityService: EmojiEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const driveFile = await this.driveFilesRepository.findOneBy({ id: ps.fileId });
			if (driveFile == null) throw new ApiError(meta.errors.noSuchFile);
			const isDuplicate = await this.customEmojiService.checkDuplicate(ps.name);
			if (isDuplicate) throw new ApiError(meta.errors.duplicateName);

			const emoji = await this.customEmojiService.add({
				driveFile,
				name: ps.name,
				category: ps.category ?? null,
				aliases: ps.aliases ?? [],
				host: null,
				license: ps.license ?? null,
				isSensitive: ps.isSensitive ?? false,
				localOnly: ps.localOnly ?? false,
				roleIdsThatCanBeUsedThisEmojiAsReaction: ps.roleIdsThatCanBeUsedThisEmojiAsReaction ?? [],
				copyPermission: ps.copyPermission ?? null,
				usageInfo: ps.usageInfo ?? null,
				author: ps.author ?? null,
				description: ps.description ?? null,
				isBasedOn: ps.isBasedOn ?? null,
			}, me);

			return this.emojiEntityService.packDetailed(emoji);
		});
	}
}
