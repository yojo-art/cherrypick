/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUB_HOST = 'z.test';
const ACTOR_URI = `https://${STUB_HOST}/users/alice`;

export async function generateActorKeys(stubRoot) {
	const { publicKey, privateKey } = generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: { type: 'spki', format: 'pem' },
		privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	});

	const usersDir = join(stubRoot, 'users');
	await mkdir(usersDir, { recursive: true });

	await writeFile(
		join(usersDir, 'alice-key.json'),
		`${JSON.stringify({ privateKeyPem: privateKey }, null, '\t')}\n`,
	);

	const actor = {
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://w3id.org/security/v1',
		],
		id: ACTOR_URI,
		type: 'Person',
		preferredUsername: 'federation-test-alice',
		name: 'Federation Test Alice',
		inbox: `https://${STUB_HOST}/inbox`,
		outbox: `https://${STUB_HOST}/outbox`,
		publicKey: {
			id: `${ACTOR_URI}#main-key`,
			owner: ACTOR_URI,
			publicKeyPem: publicKey,
		},
	};

	await writeFile(
		join(usersDir, 'alice'),
		`${JSON.stringify(actor, null, '\t')}\n`,
	);
}

const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
	const stubRoot = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)));
	await generateActorKeys(stubRoot);
}
