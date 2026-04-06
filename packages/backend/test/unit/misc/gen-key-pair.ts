/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { genRsaKeyPair, genEcKeyPair } from '@/misc/gen-key-pair.js';

describe('misc:gen-key-pair', () => {
	test('genRsaKeyPair generates valid PEM keys', async () => {
		const { publicKey, privateKey } = await genRsaKeyPair(2048);
		expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
		expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/);
	});

	test('genEcKeyPair generates valid PEM keys', async () => {
		const { publicKey, privateKey } = await genEcKeyPair('prime256v1');
		expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
		expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/);
	});

	test('genRsaKeyPair with default modulus length', async () => {
		const { publicKey, privateKey } = await genRsaKeyPair();
		expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
		expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/);
	});

	test('genEcKeyPair with default curve', async () => {
		const { publicKey, privateKey } = await genEcKeyPair();
		expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
		expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/);
	});
});
