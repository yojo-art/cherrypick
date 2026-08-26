/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import * as Path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class InternalStorageService {
	private readonly path: string;

	constructor(
		@Inject(DI.config)
		private config: Config,
	) {
		this.path = Path.resolve(this.config.rootDir, 'files');
	}

	@bindThis
	public resolvePath(key: string) {
		return Path.resolve(this.path, key);
	}

	@bindThis
	public read(key: string) {
		return fs.createReadStream(this.resolvePath(key));
	}

	@bindThis
	public copy(key: string, srcKey: string) {
		fs.mkdirSync(this.path, { recursive: true });
		fs.copyFileSync(this.resolvePath(srcKey), this.resolvePath(key));
		return this.getUrl(key);
	}

	@bindThis
	public saveFromPath(key: string, srcPath: string) {
		fs.mkdirSync(this.path, { recursive: true });
		fs.copyFileSync(srcPath, this.resolvePath(key));
		return this.getUrl(key);
	}

	@bindThis
	public saveFromBuffer(key: string, data: Buffer) {
		fs.mkdirSync(this.path, { recursive: true });
		fs.writeFileSync(this.resolvePath(key), data);
		return this.getUrl(key);
	}

	@bindThis
	private getUrl(key: string) {
		// e2eテスト環境ではmisskey.localが名前解決できず、ポート番号も本番のURLに含まれていないため、
		// テスト時のみlocalhost:[port]形式のURLに差し替える。
		const base = (process.env.NODE_ENV === 'test')
			? `http://localhost:${this.config.port}`
			: this.config.url;
		return `${base}/files/${key}`;
	}

	@bindThis
	public del(key: string) {
		fs.unlink(this.resolvePath(key), () => {});
	}
}
