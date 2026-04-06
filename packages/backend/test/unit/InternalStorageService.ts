/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { InternalStorageService } from '@/core/InternalStorageService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('InternalStorageService', () => {
	let service: InternalStorageService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<InternalStorageService>(InternalStorageService);
	});

	describe('resolvePath', () => {
		test('returns a string path', () => {
			const result = service.resolvePath('test-key');
			expect(typeof result).toBe('string');
			expect(result).toContain('test-key');
		});
	});

	describe('saveFromBuffer and del', () => {
		const testKey = `test-internal-${Date.now()}`;

		afterAll(() => {
			try { service.del(testKey); } catch {}
		});

		test('saves buffer', () => {
			const url = service.saveFromBuffer(testKey, Buffer.from('test content'));
			expect(typeof url).toBe('string');

			const resolvedPath = service.resolvePath(testKey);
			expect(fs.existsSync(resolvedPath)).toBe(true);
		});

		test('del does not throw', () => {
			expect(() => service.del(testKey)).not.toThrow();
		});
	});

	describe('saveFromPath', () => {
		const testKey = `test-internal-path-${Date.now()}`;
		let tmpFile: string;

		beforeAll(() => {
			tmpFile = path.join(os.tmpdir(), `test-src-${Date.now()}.txt`);
			fs.writeFileSync(tmpFile, 'test source file');
		});

		afterAll(() => {
			try { service.del(testKey); } catch {}
			try { fs.unlinkSync(tmpFile); } catch {}
		});

		test('copies file from source path', () => {
			const url = service.saveFromPath(testKey, tmpFile);
			expect(typeof url).toBe('string');

			const resolvedPath = service.resolvePath(testKey);
			expect(fs.existsSync(resolvedPath)).toBe(true);
		});
	});

	describe('read', () => {
		test('returns a ReadStream for saved file', () => {
			const key = `test-internal-read-${Date.now()}`;
			service.saveFromBuffer(key, Buffer.from('readable content'));
			try {
				const stream = service.read(key);
				expect(stream).toBeDefined();
				stream.destroy();
			} finally {
				try { service.del(key); } catch {}
			}
		});
	});
});
