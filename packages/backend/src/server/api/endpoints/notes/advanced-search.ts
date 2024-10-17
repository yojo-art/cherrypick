/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { AdvancedSearchService } from '@/core/AdvancedSearchService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from '../../error.js';

export const meta = {
	description: '高度な検索ができます',
	tags: ['notes'],

	requireCredential: false,
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},

	errors: {
		unavailable: {
			message: 'Advanced Search is unavailable.',
			code: 'UNAVAILABLE',
			id: '2f621660-e9b4-11ee-b87d-00155d0c9b27',
		},
		unimplemented: {
			message: 'Reaction Search is unimplemented',
			code: 'UNIMPLEMENTED',
			id: '64d1dbf5-c14c-406e-88da-0f799b4b42ea',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		// TODO: 整理する
		query: {
			type: 'string',
			description: '指定した文字列を含むノートを返します',
		},

		reactions: {
			type: 'array',
			description: '指定したリアクションがつけられたノートを探します',
			uniqueItems: true,
			minItems: 1,
			maxItems: 16,
			items: { type: 'string' },
		},
		reactionsExclude: {
			type: 'array',
			description: '指定したリアクションがつけられていないノートを探します',
			uniqueItems: true,
			minItems: 1,
			maxItems: 16,
			items: { type: 'string' },
		},
		sinceId: {
			type: 'string',
			description: '指定されたID以降のノートを返します',
			format: 'misskey:id',
		},
		untilId: {
			type: 'string',
			format: 'misskey:id',
			description: '指定されたID以前のノートを返します',
		},
		limit: {
			type: 'integer',
			minimum: 1,
			maximum: 100,
			default: 10,
			description: 'ノートを取得する件数',
		},
		origin: {
			type: 'string',
			enum: ['local', 'remote', 'combined'],
			default: 'combined',
			description: 'ノートが作成された場所',
		},
		fileOption: {
			type: 'string',
			enum: ['file-only', 'no-file', 'combined'],
			default: 'combined',
			description: 'ファイルの添付状態',
		},
		sensitiveFilter: {
			type: 'string',
			enum: ['includeSensitive', 'withOutSensitive', 'sensitiveOnly', 'combined'],
			default: 'combined',
			description: '添付ファイルのセンシティブ状態',
		},
		followingFilter: {
			type: 'string',
			enum: ['following', 'notFollowing', 'combined'],
			default: 'combined',
			description: 'ユーザーのフォロー状態',
		},
		offset: {
			type: 'integer',
			default: 0,
			description: '指定された件数の以降のノートを返します',
		},
		host: {
			type: 'string',
			description: 'ノートが作成されたインスタンス。ローカルの場合は`.`を指定します',
		},
		excludeCW: {
			type: 'boolean',
			default: false,
			description: 'CWを含むノートを除外するか',
		},
		excludeReply: {
			type: 'boolean',
			default: false,
			description: 'リプライのノートを除外するか',
		},
		excludeQuote: {
			type: 'boolean',
			default: false,
			description: '引用のノートを除外するか',
		},
		userId: {
			type: 'string',
			format: 'misskey:id',
			nullable: true,
			default: null,
			description: 'ノートを作成したユーザーのID',
		},
		useStrictSearch: {
			type: 'boolean',
			nullable: true,
			default: false,
			description: '表記ゆれ検索を無効にする',
		},
	},
} as const;

// Todo: スリムにする

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		private noteEntityService: NoteEntityService,
		private roleService: RoleService,
		private advancedSearchService: AdvancedSearchService,
	) {
		super(meta, paramDef, async(ps, me) => {
			const policies = await this.roleService.getUserPolicies(me ? me.id : null);
			if (!policies.canAdvancedSearchNotes) {
				throw new ApiError(meta.errors.unavailable);
			}

			const notes = await this.advancedSearchService.searchNote(me, {
				reactions: ps.reactions,
				reactionsExclude: ps.reactionsExclude,
				userId: ps.userId,
				host: ps.host,
				origin: ps.origin,
				fileOption: ps.fileOption,
				sensitiveFilter: ps.sensitiveFilter,
				followingFilter: ps.followingFilter,
				excludeCW: ps.excludeCW,
				excludeReply: ps.excludeReply,
				excludeQuote: ps.excludeQuote,
				offset: ps.offset,
				useStrictSearch: ps.useStrictSearch,
			}, {
				untilId: ps.untilId,
				sinceId: ps.sinceId,
				limit: ps.limit,
			}, ps.query).catch(
				(err) => {
					if (err instanceof IdentifiableError) {
						if (err.id === '084b2eec-7b60-4382-ae49-3da182d27a9a') {
							throw new ApiError(meta.errors.unimplemented);
						}
					}
					throw err;
				},
			);

			return await this.noteEntityService.packMany(notes, me);
		});
	}
}
