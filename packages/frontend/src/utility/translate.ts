/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const STATUSES = ['none', 'running', 'success', 'error'] as const;
export type TranslateStatus = typeof STATUSES[number];
