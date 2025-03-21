/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { IEvent } from '@/models/Event.js';
import { isEvent } from '../type.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApResolverService } from '../ApResolverService.js';
import type { Resolver } from '../ApResolverService.js';
import type { IObject } from '../type.js';

@Injectable()
export class ApEventService {
	private logger: Logger;

	constructor(
		private apResolverService: ApResolverService,
		private apLoggerService: ApLoggerService,
	) {
		this.logger = this.apLoggerService.logger;
	}

	@bindThis
	public async extractEventFromNote(source: string | IObject, resolverParam?: Resolver): Promise<IEvent> {
		let note:IObject;
		if (typeof source === 'object') {
			note = source;
		} else {
			const resolver = resolverParam ?? this.apResolverService.createResolver();
			note = await resolver.resolve(source);
		}

		if (!isEvent(note)) {
			throw new Error('invalid type');
		}

		if (note.name && note.startTime) {
			const title = note.name;
			const start = new Date(note.startTime);
			const end = note.endTime ? new Date(note.endTime) : null;

			return {
				title,
				start,
				end,
				metadata: {
					'@type': 'Event',
					name: note.name,
					url: note.href,
					startDate: start.toISOString(),
					endDate: end?.toISOString(),
					description: note.summary,
					identifier: note.id,
				},
			};
		} else {
			throw new Error('Invalid event properties');
		}
	}
}
