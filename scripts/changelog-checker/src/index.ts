/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as process from 'process';
import * as fs from 'fs';
import { parseChangeLog } from './parser.js';
import { checkNewRelease, checkNewTopic } from './checker.js';

function abort(message?: string) {
	if (message) {
		console.error(message);
	}

	process.exit(1);
}

function main() {
	if (!fs.existsSync('./CHANGELOG_YOJO-base.md') || !fs.existsSync('./CHANGELOG_YOJO-head.md')) {
		console.error('CHANGELOG_YOJO-base.md or CHANGELOG_YOJO-head.md is missing.');
		return;
	}

	const base = parseChangeLog('./CHANGELOG_YOJO-base.md');
	const head = parseChangeLog('./CHANGELOG_YOJO-head.md');

	const result = (base.length < head.length)
		? checkNewRelease(base, head)
		: checkNewTopic(base, head);

	if (!result.success) {
		abort(result.message);
		return;
	}
}

main();
