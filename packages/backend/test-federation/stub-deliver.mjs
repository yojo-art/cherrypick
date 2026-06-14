/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID, sign } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const STUB_ROOT = '/stub';
const STUB_HOST = 'z.test';
const ACTOR_URI = `https://${STUB_HOST}/users/alice`;
const KEY_ID = `${ACTOR_URI}#main-key`;
const ALLOWED_TARGETS = new Set(['a.test', 'b.test', 'c.test']);

/** @type {string | undefined} */
let privateKeyPem;

async function getPrivateKeyPem() {
	if (privateKeyPem == null) {
		const key = JSON.parse(await readFile(join(STUB_ROOT, 'users/alice-key.json'), 'utf8'));
		privateKeyPem = key.privateKeyPem;
	}
	return privateKeyPem;
}

function createSignedActivityPost({ url, body, privateKeyPem: keyPem, keyId }) {
	const target = new URL(url);
	const digestHeader = `SHA-256=${createHash('sha256').update(body).digest('base64')}`;
	const date = new Date().toUTCString();
	const signingString = `(request-target): post ${target.pathname}\ndate: ${date}\nhost: ${target.host}\ndigest: ${digestHeader}`;
	const signature = sign('sha256', Buffer.from(signingString), keyPem).toString('base64');
	const signatureHeader = `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) date host digest",signature="${signature}"`;

	return {
		'Content-Type': 'application/activity+json',
		'Date': date,
		'Digest': digestHeader,
		'Signature': signatureHeader,
	};
}

async function loadNote(notePath) {
	if (!/^[a-z0-9-]+$/.test(notePath)) {
		throw new Error(`invalid notePath: ${notePath}`);
	}
	return JSON.parse(await readFile(join(STUB_ROOT, 'notes', notePath), 'utf8'));
}

async function deliverNote(targetHost, notePath) {
	if (!ALLOWED_TARGETS.has(targetHost)) {
		throw new Error(`invalid targetHost: ${targetHost}`);
	}

	const note = await loadNote(notePath);
	const body = JSON.stringify({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'Create',
		id: `https://${STUB_HOST}/activities/create/${notePath}#${randomUUID()}`,
		actor: ACTOR_URI,
		object: note,
		to: ['https://www.w3.org/ns/activitystreams#Public'],
	});
	const inboxUrl = `https://${targetHost}/inbox`;
	const headers = createSignedActivityPost({
		url: inboxUrl,
		body,
		privateKeyPem: await getPrivateKeyPem(),
		keyId: KEY_ID,
	});
	const response = await fetch(inboxUrl, {
		method: 'POST',
		headers,
		body,
	});

	return {
		activityId: JSON.parse(body).id,
		inboxUrl,
		inboxStatus: response.status,
	};
}

function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', chunk => chunks.push(chunk));
		req.on('end', () => {
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
			} catch (error) {
				reject(error);
			}
		});
		req.on('error', reject);
	});
}

async function main() {
	const { generateActorKeys } = await import(pathToFileURL(join(STUB_ROOT, 'generate-actor-keys.mjs')).href);
	await generateActorKeys(STUB_ROOT);

	const server = createServer(async (req, res) => {
		try {
			if (req.method === 'GET' && req.url === '/health') {
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('ok');
				return;
			}

			if (req.method === 'POST' && req.url === '/deliver') {
				const { targetHost, notePath } = await readJsonBody(req);
				if (typeof targetHost !== 'string' || typeof notePath !== 'string') {
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: 'targetHost and notePath are required' }));
					return;
				}

				const result = await deliverNote(targetHost, notePath);
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(result));
				return;
			}

			res.writeHead(404, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'not found' }));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			res.writeHead(500, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: message }));
		}
	});

	server.listen(3000, () => {
		console.log('z.test stub-deliver listening on :3000');
	});
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
