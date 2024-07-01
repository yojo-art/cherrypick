/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import type { MiOfficialTag, OfficialTagRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['official-Tags'],

	requireCredential: true,
	requireModerator: true,
	requireAdmin: false,
	kind: 'write:admin:official-tags',

	limit: {
		duration: 1000 * 60,
		max: 50,
	},
	errors: {
		emptyTagString: {
			message: 'EmptyTag',
			code: 'EMPTY_TAG_STRING',
			id: '374c8d76-336f-4b05-b6d2-64db9b9b45e8',
		},
		duplicateTagName: {
			message: 'DuplicateTagName',
			code: 'DUPLICATE_TAG_NAME',
			id: '943d203d-073b-4794-b7b7-38c49ecbd030',
		},
	},
	secure: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		body: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					tag: {
						type: 'string',
						nullable: false,
					},
					description: {
						type: 'string',
						nullable: true,
					},
					bannerUrl: {
						type: 'string',
						nullable: true,
					},
					priority: {
						type: 'number',
						nullable: false,
					},
				},
			},
		},
	},
	required: ['body'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private moderationLogService: ModerationLogService,
		@Inject(DI.officialTagRepository)
		private officialTagRepository: OfficialTagRepository,
		private queryService: QueryService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, user, token) => {
			const insertData :MiOfficialTag[] = [];
			const indexed : any = {};
			for (const d of ps.body) {
				let name;
				if (d.tag === undefined || d.tag.length < 1) {
					throw new ApiError(meta.errors.emptyTagString);
				} else {
					name = d.tag;
				}
				let bannerUrl;
				if (d.bannerUrl === undefined || d.bannerUrl === null || d.bannerUrl.length < 1) {
					bannerUrl = null;
				} else {
					bannerUrl = d.bannerUrl;
				}
				let description;
				if (d.description === undefined || d.description === null || d.description.length < 1) {
					description = null;
				} else {
					description = d.description;
				}
				let priority;
				if (d.priority === undefined) {
					priority = 100;
				} else {
					priority = d.priority;
				}
				const e = {
					id: '',
					name,
					description,
					bannerUrl,
					priority,
				};
				insertData.push(e);
				if (indexed[name] === undefined) {
					indexed[name] = e;
				} else {
					throw new ApiError(meta.errors.duplicateTagName, name);
				}
			}
			const query = this.queryService.makePaginationQuery(this.officialTagRepository.createQueryBuilder('official_tag'));
			const old_values = await query.getMany();
			const deleteData :MiOfficialTag[] = [];
			for (const old of old_values) {
				if (indexed[old.name] === undefined) {
					//削除されてた時
					deleteData.push(old);
				} else {
					const tag :MiOfficialTag = indexed[old.name];
					if (tag === old) {
						//すでに登録されてる時は登録予定から外す
						const idx = insertData.indexOf(tag);
						insertData.splice(idx, 1);
					} else {
						deleteData.push(old);
						tag.id = old.id;
					}
				}
			}
			for (const add_tag of insertData) {
				if (add_tag.id === '') {
					add_tag.id = this.idService.gen();
				}
			}
			if (deleteData.length > 0) {
				await this.officialTagRepository.remove(deleteData);
			}
			if (insertData.length > 0) {
				await this.officialTagRepository.insert(insertData);
			}
			this.moderationLogService.log(user, 'updateOfficialTags', {
				insert_data: insertData.map(d => {
					return {
						id: d.id,
						tag: d.name,
						bannerUrl: d.bannerUrl,
						description: d.description,
						priority: d.priority,
					};
				}),
			});
		});
	}
}
