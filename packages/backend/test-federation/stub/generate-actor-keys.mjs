/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUB_HOST = 'z.test';
const ACTOR_URI_BASE = `https://${STUB_HOST}/users`;

export async function generateActorKeys(stubRoot) {
	const usersDir = join(stubRoot, 'users');
	await mkdir(usersDir, { recursive: true });

	await generateActor(usersDir, {
		name: 'zack',
		preferredUsername: 'federation-test-zack',
		displayName: 'Federation Test Zack',
	});
	// JsonLD署名の creator/actor 不一致テスト用 (zack とは別鍵の正規アクター)
	await generateActor(usersDir, {
		name: 'mallory',
		preferredUsername: 'federation-test-mallory',
		displayName: 'Federation Test Mallory',
	});
}

async function generateActor(usersDir, { name, preferredUsername, displayName }) {
	const actorUri = `${ACTOR_URI_BASE}/${name}`;
	const { publicKey, privateKey } = generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: { type: 'spki', format: 'pem' },
		privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	});

	await writeFile(
		join(usersDir, `${name}-key.json`),
		`${JSON.stringify({ privateKeyPem: privateKey }, null, '\t')}\n`,
	);

	const actor = {
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://w3id.org/security/v1',
		],
		id: actorUri,
		type: 'Person',
		preferredUsername,
		name: displayName,
		inbox: `https://${STUB_HOST}/inbox`,
		outbox: `https://${STUB_HOST}/outbox`,
		publicKey: {
			id: `${actorUri}#main-key`,
			owner: actorUri,
			publicKeyPem: publicKey,
		},
	};

	await writeFile(
		join(usersDir, name),
		`${JSON.stringify(actor, null, '\t')}\n`,
	);
}

const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
	const stubRoot = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)));
	await generateActorKeys(stubRoot);
}
