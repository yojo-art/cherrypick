/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileWriterStream } from '@/misc/FileWriterStream.js';

describe('misc:FileWriterStream', () => {
	test('writes data to file', async () => {
		const tmpFile = path.join(os.tmpdir(), `test-fws-${Date.now()}.txt`);
		try {
			const stream = new FileWriterStream(tmpFile);
			const writer = stream.getWriter();
			await writer.write(new TextEncoder().encode('hello'));
			await writer.write(new TextEncoder().encode(' world'));
			await writer.close();

			const content = fs.readFileSync(tmpFile, 'utf-8');
			expect(content).toBe('hello world');
		} finally {
			if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
		}
	});
});
