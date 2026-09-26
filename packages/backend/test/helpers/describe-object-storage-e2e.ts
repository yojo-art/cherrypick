/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe } from 'vitest';

/**
 * describeObjectStorageE2E で宣言される suite の名前に付ける共通プレフィックス。
 * `vitest --testNamePattern="^\[object-storage\] "` でこのプレフィックスを持つ suite のみ実行する。
 */
export const OBJECT_STORAGE_SUITE_PREFIX = '[object-storage] ';

/**
 * オブジェクトストレージ E2E CI で実行する suite を宣言する。
 *
 * package.json の test:e2e:object-storage スクリプトの `--testNamePattern` を使って
 * 本関数で宣言された suite のみ実行する。
 * 環境変数 OBJECT_STORAGE_E2E が truthy でない場合 (rustfs 等のローカルオブジェクトストレージが
 * 起動していない通常の e2e 実行) は skip する。
 */
export function describeObjectStorageE2E(name: string, fn: () => void): void {
	if (!process.env.OBJECT_STORAGE_E2E) {
		describe.skip(OBJECT_STORAGE_SUITE_PREFIX + name, fn);
		return;
	}

	describe(OBJECT_STORAGE_SUITE_PREFIX + name, fn);
}
