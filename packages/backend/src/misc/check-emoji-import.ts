/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// @ts-ignore
export function checkMatch(ps?: string|null, usageInfo: string|null, license: string|null): boolean {
	if(ps === null && usageInfo === null && license === null) return true;
	if(!usageInfo && ! license) return false;
	if(!ps) return false;
	return  ps == (usageInfo ?? license);
}
