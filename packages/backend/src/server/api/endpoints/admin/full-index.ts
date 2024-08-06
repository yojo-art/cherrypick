/**
 * SPDX-FileCopyrightText: syuilo and misskey-project, TeamNijimiss(@nafu-at), yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { AdvancedSearchService } from '@/core/AdvancedSearchService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:meta',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
	},
	required: [],
} as const;
 
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		private advancedSearchService: AdvancedSearchService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.advancedSearchService.fullIndexNote();
		});
	}
}
