/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// @ts-ignore
export function checkMatch(licenseReadText?: string|null, license: string|null): boolean {
	if(licenseReadText === null && license === null) return true;
	if(!license) return false;
	if(!licenseReadText) return false;
	return  licenseReadText === license;
}
