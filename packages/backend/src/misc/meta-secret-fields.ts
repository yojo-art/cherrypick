/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const META_SECRET_FIELDS = [
	'hcaptchaSecretKey',
	'mcaptchaSecretKey',
	'recaptchaSecretKey',
	'turnstileSecretKey',
	'smtpPass',
	'swPrivateKey',
	'objectStorageSecretKey',
	'deeplAuthKey',
	'verifymailAuthKey',
	'truemailAuthKey',
] as const;
