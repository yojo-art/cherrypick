/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { loadConfig } from '../../src/config.js';

type Describe = typeof describe;

let openSearchSuiteDepth = 0;
let originalDescribe: Describe | null = null;
let filterInstalled = false;

/**
 * OPENSEARCH_E2E=1 のとき、トップレベルの通常 describe を skip する。
 * describeOpenSearchE2E 内のネストされた describe は depth によりそのまま実行される。
 */
export function installOpenSearchE2EFilter(): void {
	if (process.env.OPENSEARCH_E2E !== '1' || filterInstalled) return;
	filterInstalled = true;

	originalDescribe = globalThis.describe;
	const orig = originalDescribe;

	const wrappedDescribe = ((...args: Parameters<Describe>) => {
		if (openSearchSuiteDepth === 0) {
			return orig.skip(...(args as Parameters<Describe['skip']>));
		}
		return orig(...args);
	}) as Describe;

	wrappedDescribe.skip = orig.skip.bind(orig);
	wrappedDescribe.only = orig.only.bind(orig);
	wrappedDescribe.each = orig.each.bind(orig);

	globalThis.describe = wrappedDescribe;
}

function runOpenSearchDescribe(name: string, fn: () => void): void {
	const d = originalDescribe ?? globalThis.describe;
	d(name, () => {
		openSearchSuiteDepth++;
		try {
			fn();
		} finally {
			openSearchSuiteDepth--;
		}
	});
}

/**
 * OpenSearch E2E CI（OPENSEARCH_E2E=1）でも実行する suite を宣言する。
 * requireOpenSearch が true のとき、config に opensearch が無ければ skip する。
 */
export function describeOpenSearchE2E(
	name: string,
	fnOrOpts: (() => void) | { requireOpenSearch?: boolean },
	fn?: () => void,
): void {
	let callback: () => void;
	let opts: { requireOpenSearch?: boolean } | undefined;

	if (typeof fnOrOpts === 'function') {
		callback = fnOrOpts;
		opts = undefined;
	} else {
		opts = fnOrOpts;
		if (fn == null) {
			throw new Error('describeOpenSearchE2E: callback is required');
		}
		callback = fn;
	}

	if (opts?.requireOpenSearch) {
		const config = loadConfig();
		if (!config.opensearch) {
			(originalDescribe ?? globalThis.describe).skip(name, callback);
			return;
		}
	}

	if (process.env.OPENSEARCH_E2E === '1') {
		runOpenSearchDescribe(name, callback);
		return;
	}

	globalThis.describe(name, callback);
}
