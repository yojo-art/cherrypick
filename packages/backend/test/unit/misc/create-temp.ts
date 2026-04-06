/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import * as fs from 'node:fs';
import { createTemp, createTempDir } from '@/misc/create-temp.js';

describe('misc:create-temp', () => {
	test('createTemp returns path and cleanup function', async () => {
		const [path, cleanup] = await createTemp();
		expect(typeof path).toBe('string');
		expect(typeof cleanup).toBe('function');
		expect(fs.existsSync(path)).toBe(true);
		cleanup();
	});

	test('createTempDir returns path and cleanup function', async () => {
		const [path, cleanup] = await createTempDir();
		expect(typeof path).toBe('string');
		expect(typeof cleanup).toBe('function');
		expect(fs.existsSync(path)).toBe(true);
		expect(fs.statSync(path).isDirectory()).toBe(true);
		cleanup();
	});
});
