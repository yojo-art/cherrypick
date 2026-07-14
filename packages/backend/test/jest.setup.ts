/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { initTestDb, sendEnvResetRequest } from './utils.js';
import { installOpenSearchE2EFilter } from './helpers/describe-opensearch-e2e.js';

installOpenSearchE2EFilter();

beforeAll(async () => {
	await initTestDb(false);
	await sendEnvResetRequest();
});

