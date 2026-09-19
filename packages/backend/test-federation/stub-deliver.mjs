/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID, sign } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const STUB_ROOT = '/stub';
const STUB_HOST = 'z.test';
const ACTOR_URI = `https://${STUB_HOST}/users/zack`;
const KEY_ID = `${ACTOR_URI}#main-key`;
const MALLORY_ACTOR_URI = `https://${STUB_HOST}/users/mallory`;
const MALLORY_KEY_ID = `${MALLORY_ACTOR_URI}#main-key`;
const ALLOWED_TARGETS = new Set(['a.test', 'b.test', 'c.test']);
const LD_CONTEXTS_PATH = '/app/ld-contexts.json';
const LD_MODES = new Set(['none', 'valid', 'tampered-body', 'tampered-value', 'wrong-type', 'creator-mismatch']);
const HTTP_MODES = new Set(['valid', 'broken']);

/**
 * Record of activities POSTed to https://z.test/inbox by the tested instances.
 * Lets federation tests observe (or assert the absence of) deliveries,
 * e.g. to verify that a specified (DM) note edit is not sent to followers.
 */
const receivedActivities = [];
const MAX_RECEIVED = 500;

function recordReceived(body) {
	receivedActivities.push({ receivedAt: new Date().toISOString(), body });
	if (receivedActivities.length > MAX_RECEIVED) {
		receivedActivities.splice(0, receivedActivities.length - MAX_RECEIVED);
	}
}

/** @type {string | undefined} */
let privateKeyPem;
/** @type {string | undefined} */
let malloryPrivateKeyPem;
/** @type {any | undefined} */
let jsonldLib;
/** @type {Record<string, any> | undefined} */
let ldContexts;

async function getPrivateKeyPem() {
	if (privateKeyPem == null) {
		const key = JSON.parse(await readFile(join(STUB_ROOT, 'users/zack-key.json'), 'utf8'));
		privateKeyPem = key.privateKeyPem;
	}
	return privateKeyPem;
}

async function getMalloryPrivateKeyPem() {
	if (malloryPrivateKeyPem == null) {
		const key = JSON.parse(await readFile(join(STUB_ROOT, 'users/mallory-key.json'), 'utf8'));
		malloryPrivateKeyPem = key.privateKeyPem;
	}
	return malloryPrivateKeyPem;
}

function loadJsonLd() {
	if (jsonldLib == null) {
		let mod;
		try {
			// ./stub-vendor (setup.sh で調達) を /app/vendor にマウントして使う
			mod = createRequire('/app/vendor/package.json')('jsonld');
		} catch (error) {
			throw new Error(`jsonld is not vendored; run setup.sh with network access first: ${error instanceof Error ? error.message : String(error)}`);
		}
		jsonldLib = mod.default ?? mod;
	}
	return jsonldLib;
}

async function loadLdContexts() {
	if (ldContexts == null) {
		ldContexts = JSON.parse(await readFile(LD_CONTEXTS_PATH, 'utf8'));
	}
	return ldContexts;
}

function createLdDocumentLoader(preloaded) {
	return async (url) => {
		if (url in preloaded) {
			return {
				contextUrl: undefined,
				document: preloaded[url],
				documentUrl: url,
			};
		}
		throw new Error(`LD context is not vendored: ${url}`);
	};
}

function sha256hex(data) {
	return createHash('sha256').update(data).digest('hex');
}

// JsonLdService.createVerifyData と同じ正規化手順 (RsaSignature2017)
async function createLdVerifyData(jsonld, documentLoader, data, options) {
	const transformedOptions = {
		...options,
		'@context': 'https://w3id.org/identity/v1',
	};
	delete transformedOptions['type'];
	delete transformedOptions['id'];
	delete transformedOptions['signatureValue'];
	const canonizedOptions = await jsonld.normalize(transformedOptions, { documentLoader });
	const optionsHash = sha256hex(canonizedOptions.toString());
	const transformedData = { ...data };
	delete transformedData['signature'];
	const canonizedData = await jsonld.normalize(transformedData, { documentLoader });
	const documentHash = sha256hex(canonizedData.toString());
	return `${optionsHash}${documentHash}`;
}

// JsonLdService.signRsaSignature2017 と同じ手順で Activity に LD 署名を付与する
async function signActivityLdSignature(activity, privateKeyPemValue, creator) {
	const jsonld = loadJsonLd();
	const preloaded = await loadLdContexts();
	const documentLoader = createLdDocumentLoader(preloaded);
	const options = {
		type: 'RsaSignature2017',
		creator,
		nonce: randomBytes(16).toString('hex'),
		created: new Date().toISOString(),
	};
	const toBeSigned = await createLdVerifyData(jsonld, documentLoader, activity, options);
	const signature = sign('sha256', Buffer.from(toBeSigned), privateKeyPemValue).toString('base64');
	return {
		...activity,
		signature: {
			...options,
			signatureValue: signature,
		},
	};
}

function tamperMiddleChar(value) {
	const pos = Math.floor(value.length / 2);
	const flipped = value[pos] === 'A' ? 'B' : 'A';
	return value.slice(0, pos) + flipped + value.slice(pos + 1);
}

// ld モードに従って Activity の LD 署名を付与・改変する
async function applyLdMode(activity, ld) {
	if (ld === 'creator-mismatch') {
		// actor(zack)とは別アクター(mallory)の正規署名。actor binding 検査で拒否される想定
		return await signActivityLdSignature(activity, await getMalloryPrivateKeyPem(), MALLORY_KEY_ID);
	}
	const signed = await signActivityLdSignature(activity, await getPrivateKeyPem(), KEY_ID);
	if (ld === 'tampered-body') {
		if (signed.object != null && typeof signed.object === 'object' && typeof signed.object.content === 'string') {
			signed.object = { ...signed.object, content: `${signed.object.content}<p>tampered</p>` };
		} else if (typeof signed.content === 'string') {
			signed.content = `${signed.content}<p>tampered</p>`;
		} else {
			// Announce 等 (object が文字列): 署名後に audience へ無害な URI を追加して署名を壊す
			const to = Array.isArray(signed.to) ? signed.to : [signed.to].filter(v => v != null);
			signed.to = [...to, `https://${STUB_HOST}/tampered`];
		}
		return signed;
	}
	if (ld === 'tampered-value') {
		signed.signature = { ...signed.signature, signatureValue: tamperMiddleChar(signed.signature.signatureValue) };
		return signed;
	}
	if (ld === 'wrong-type') {
		signed.signature = { ...signed.signature, type: 'DataIntegrityProof' };
		return signed;
	}
	return signed;
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

function breakSignatureHeader(signatureHeader) {
	return signatureHeader.replace(/signature="([^"]+)"/, (_match, value) => `signature="${tamperMiddleChar(value)}"`);
}

async function loadNoteRaw(notePath) {
	if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(notePath)) {
		throw new Error(`invalid notePath: ${notePath}`);
	}
	const noteFile = resolve(STUB_ROOT, 'notes', ...notePath.split('/'));
	if (!noteFile.startsWith(resolve(STUB_ROOT, 'notes'))) {
		throw new Error(`invalid notePath: ${notePath}`);
	}
	return readFile(noteFile, 'utf8');
}

function resolvePlaceholders(text, placeholders) {
	if (placeholders == null || typeof placeholders !== 'object' || Array.isArray(placeholders)) return text;
	for (const [key, value] of Object.entries(placeholders)) {
		if (value == null) continue;
		const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		text = text.replaceAll(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), String(value));
	}
	return text;
}

async function deliverActivity(targetHost, notePath, placeholders = {}, deliveryOptions = {}) {
	if (!ALLOWED_TARGETS.has(targetHost)) {
		throw new Error(`invalid targetHost: ${targetHost}`);
	}

	const { ld = 'none', http = 'valid', activityId = null } = deliveryOptions;
	if (!LD_MODES.has(ld)) {
		throw new Error(`invalid ld mode: ${ld}`);
	}
	if (!HTTP_MODES.has(http)) {
		throw new Error(`invalid http mode: ${http}`);
	}

	const raw = await loadNoteRaw(notePath);
	const resolved = resolvePlaceholders(raw, placeholders);
	const note = JSON.parse(resolved);

	let activity;
	if (note.type === 'Announce') {
		activity = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			...note,
		};
		if (!activity.id) {
			activity.id = `https://${STUB_HOST}/activities/announce/${notePath}#${randomUUID()}`;
		}
	} else {
		activity = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			type: 'Create',
			id: `https://${STUB_HOST}/activities/create/${notePath}#${randomUUID()}`,
			actor: ACTOR_URI,
			object: note,
			to: note.to ?? ['https://www.w3.org/ns/activitystreams#Public'],
			cc: note.cc ?? [],
		};
	}

	if (typeof activityId === 'string' && activityId !== '') {
		activity.id = activityId;
	}

	if (ld !== 'none') {
		activity = await applyLdMode(activity, ld);
	}

	const body = JSON.stringify(activity);
	const inboxUrl = `https://${targetHost}/inbox`;
	const headers = createSignedActivityPost({
		url: inboxUrl,
		body,
		privateKeyPem: await getPrivateKeyPem(),
		keyId: KEY_ID,
	});
	if (http === 'broken') {
		headers['Signature'] = breakSignatureHeader(headers['Signature']);
	}
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

async function deliverFollow(targetHost, object) {
	if (!ALLOWED_TARGETS.has(targetHost)) {
		throw new Error(`invalid targetHost: ${targetHost}`);
	}

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'Follow',
		id: `https://${STUB_HOST}/activities/follow/${randomUUID()}`,
		actor: ACTOR_URI,
		object,
	};
	const body = JSON.stringify(activity);
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
		activityId: activity.id,
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
				const { targetHost, notePath, placeholders, ld, http, activityId } = await readJsonBody(req);
				if (typeof targetHost !== 'string' || typeof notePath !== 'string') {
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: 'targetHost and notePath are required' }));
					return;
				}

				const result = await deliverActivity(targetHost, notePath, placeholders, { ld, http, activityId });
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(result));
				return;
			}

			if (req.method === 'POST' && req.url === '/follow') {
				const { targetHost, object } = await readJsonBody(req);
				if (typeof targetHost !== 'string' || typeof object !== 'string') {
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: 'targetHost and object are required' }));
					return;
				}

				const result = await deliverFollow(targetHost, object);
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(result));
				return;
			}

			if (req.method === 'POST' && req.url === '/inbox') {
				let body = null;
				try {
					body = await readJsonBody(req);
				} catch {
					body = null;
				}
				recordReceived(body);
				res.writeHead(202, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ ok: true }));
				return;
			}

			if (req.method === 'GET' && req.url.startsWith('/received')) {
				const url = new URL(req.url, 'http://localhost');
				const text = url.searchParams.get('text');
				const list = text == null || text === ''
					? receivedActivities
					: receivedActivities.filter(entry => JSON.stringify(entry.body).includes(text));
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(list));
				return;
			}

			if (req.method === 'POST' && req.url === '/received/clear') {
				receivedActivities.length = 0;
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ ok: true }));
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
