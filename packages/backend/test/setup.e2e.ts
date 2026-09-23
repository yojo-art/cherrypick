/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeAll } from 'vitest';
import { initTestDb, startTestServer, stopTestServer } from './utils.js';

beforeAll(async () => {
	await stopTestServer();
	await initTestDb(false);
	await startTestServer();
});
