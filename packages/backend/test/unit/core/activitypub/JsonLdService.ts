/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { JsonLd } from '@/core/activitypub/JsonLdService.js';
import type { HttpRequestService } from '@/core/HttpRequestService.js';

// signRsaSignature2017/verifyRsaSignature2017 が参照するコンテキスト
// (activitystreams, w3id.org/identity/v1) はどちらも PRELOADED_CONTEXTS に
// 含まれるため、documentLoader が httpRequestService.send を呼ぶことはない。
function createJsonLd(): JsonLd {
	return new JsonLd({} as HttpRequestService);
}

function generateRsaKeyPair() {
	return generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: { type: 'spki', format: 'pem' },
		privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	});
}

function createActivity(overrides: Record<string, unknown> = {}) {
	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'Create',
		id: 'https://z.test/activities/create/1',
		actor: 'https://z.test/users/zack',
		object: {
			type: 'Note',
			id: 'https://z.test/notes/1',
			content: 'hello',
		},
		...overrides,
	};
}

describe('JsonLd RsaSignature2017', () => {
	it('正しい鍵で署名したactivityは同じ公開鍵で検証できる', async () => {
		const jsonLd = createJsonLd();
		const { privateKey, publicKey } = generateRsaKeyPair();

		const signed = await jsonLd.signRsaSignature2017(createActivity(), privateKey, 'https://z.test/users/zack#main-key');

		await expect(jsonLd.verifyRsaSignature2017(signed, publicKey)).resolves.toBe(true);
	});

	it('署名後に本文が改ざんされたactivityは検証に失敗する', async () => {
		const jsonLd = createJsonLd();
		const { privateKey, publicKey } = generateRsaKeyPair();

		const signed = await jsonLd.signRsaSignature2017(createActivity(), privateKey, 'https://z.test/users/zack#main-key');
		const tampered = {
			...signed,
			object: { ...signed.object, content: 'tampered' },
		};

		await expect(jsonLd.verifyRsaSignature2017(tampered, publicKey)).resolves.toBe(false);
	});

	it('signatureValueが改ざんされたactivityは検証に失敗する', async () => {
		const jsonLd = createJsonLd();
		const { privateKey, publicKey } = generateRsaKeyPair();

		const signed = await jsonLd.signRsaSignature2017(createActivity(), privateKey, 'https://z.test/users/zack#main-key');
		const tampered = {
			...signed,
			signature: {
				...signed.signature,
				signatureValue: signed.signature.signatureValue.startsWith('A')
					? `B${signed.signature.signatureValue.slice(1)}`
					: `A${signed.signature.signatureValue.slice(1)}`,
			},
		};

		await expect(jsonLd.verifyRsaSignature2017(tampered, publicKey)).resolves.toBe(false);
	});

	it('署名者と異なる鍵ペアの公開鍵では検証に失敗する', async () => {
		const jsonLd = createJsonLd();
		const { privateKey } = generateRsaKeyPair();
		const { publicKey: otherPublicKey } = generateRsaKeyPair();

		const signed = await jsonLd.signRsaSignature2017(createActivity(), privateKey, 'https://z.test/users/zack#main-key');

		await expect(jsonLd.verifyRsaSignature2017(signed, otherPublicKey)).resolves.toBe(false);
	});

	it('createVerifyDataは同じ入力に対して決定論的なハッシュを返す', async () => {
		const jsonLd = createJsonLd();
		const activity = createActivity();
		const options = { type: 'RsaSignature2017', creator: 'https://z.test/users/zack#main-key', nonce: 'fixed-nonce', created: '2024-01-01T00:00:00.000Z' };

		const first = await jsonLd.createVerifyData(activity, options);
		const second = await jsonLd.createVerifyData(activity, options);

		expect(first).toBe(second);
	});
});
