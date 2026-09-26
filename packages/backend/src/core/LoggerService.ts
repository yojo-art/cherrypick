/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { logManager } from '@/logging/logging-runtime.js';
import { CloudLoggingBackend } from '@/logging/CloudLoggingBackend.js';
import type { Logging } from '@google-cloud/logging';
import type { Keyword } from 'color-convert';

@Injectable()
export class LoggerService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.cloudLogging)
		private cloudLogging: Logging | null,
	) {
		if (this.cloudLogging) {
			const log = this.cloudLogging.log(this.config.cloudLogging?.logName ?? 'cherrypick');
			logManager.addBackend(new CloudLoggingBackend(log));
		}
	}

	@bindThis
	public getLogger(domain: string, color?: Keyword | undefined) {
		return new Logger(domain, color);
	}
}
