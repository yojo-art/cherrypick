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
		const testKey = `test-internal-read-${Date.now()}`;

		beforeAll(() => {
			service.saveFromBuffer(testKey, Buffer.from('readable content'));
		});

		afterAll(() => {
			try { service.del(testKey); } catch {}
		});

		test('returns a ReadStream', () => {
			const stream = service.read(testKey);
			expect(stream).toBeDefined();
			stream.destroy();
		});
	});
});
