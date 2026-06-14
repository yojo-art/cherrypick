import { deepStrictEqual, strictEqual } from 'assert';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as Misskey from 'misskey-js';
import { WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ADMIN_PARAMS = { username: 'admin', password: 'admin' };
const ADMIN_CACHE = new Map<Host, SigninResponse>();

await Promise.all([
	fetchAdmin('a.test'),
	fetchAdmin('b.test'),
]);

type SigninResponse = Omit<Misskey.entities.SigninFlowResponse & { finished: true }, 'finished'>;

export type LoginUser = SigninResponse & {
	client: Misskey.api.APIClient;
	username: string;
	password: string;
};

/** used for avoiding overload and some endpoints */
export type Request = <
	E extends keyof Misskey.Endpoints,
	P extends Misskey.Endpoints[E]['req'],
>(
	endpoint: E,
	params: P,
	credential?: string | null,
) => Promise<Misskey.api.SwitchCaseResponseType<E, P>>;

type Host = 'a.test' | 'b.test' | 'c.test' | 'z.test';
type FederationTestTargetHost = 'a.test' | 'b.test' | 'c.test';
export const FEDERATION_STUB_HOST: Host = 'z.test';

export function federationTestStubUri(path: string): string {
	return `https://${FEDERATION_STUB_HOST}/${path}`;
}

type DeliverFederationTestNoteResponse = {
	activityId: string;
	inboxUrl: string;
	inboxStatus: number;
};

export async function deliverFederationTestNote(
	targetHost: FederationTestTargetHost,
	notePath: string,
): Promise<DeliverFederationTestNoteResponse> {
	const response = await fetch(federationTestStubUri('deliver'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ targetHost, notePath }),
	});
	const body = await response.json() as DeliverFederationTestNoteResponse & { error?: string };
	strictEqual(
		response.status,
		200,
		`z.test deliver API failed for ${notePath} -> ${targetHost}: ${response.status} ${JSON.stringify(body)}`,
	);
	strictEqual(
		body.inboxStatus,
		202,
		`z.test signed inbox delivery failed for ${notePath} -> ${targetHost}: inbox returned ${body.inboxStatus}`,
	);
	return body;
}

export async function waitForFederationTestNote(
	viewer: LoginUser,
	notePath: string,
	options?: { timeout?: number },
): Promise<Misskey.entities.Note> {
	const uri = federationTestStubUri(`notes/${notePath}`);
	let note: Misskey.entities.Note | undefined;
	// inbox キュー処理を優先し、ap/show による z.test への重複 GET を抑える
	await sleep(500);
	await waitFor(async () => {
		try {
			const result = await viewer.client.request('ap/show', { uri });
			if (result.type !== 'Note') return false;
			note = result.object;
			return true;
		} catch {
			return false;
		}
	}, { timeout: options?.timeout ?? 30_000, interval: 1_000 });
	if (note == null) throw new Error(`federation test note not ingested: ${uri}`);
	return note;
}

export function assertEmojiAliasesEqual(actual: readonly string[], expected: readonly string[]): void {
	deepStrictEqual(JSON.stringify(actual), JSON.stringify(expected));
}

export async function sleep(ms = 250): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Polls `predicate` until it resolves to `true`, or throws once `timeout` (ms) elapses.
 * Prefer this over a fixed `sleep` when waiting for eventual federation propagation,
 * so the test does not depend on a hard-coded delay being long enough.
 */
export async function waitFor(
	predicate: () => Promise<boolean> | boolean,
	{ timeout = 10_000, interval = 500 }: { timeout?: number; interval?: number } = {},
): Promise<void> {
	const start = Date.now();
	for (;;) {
		if (await predicate()) return;
		if (Date.now() - start >= timeout) {
			throw new Error(`waitFor: condition was not met within ${timeout}ms`);
		}
		await sleep(interval);
	}
}

/**
 * Polls `sample` until it returns a strictly-equal value `stableTimes` times in a row,
 * approximating that background processing (e.g. a fire-and-forget federation job) has settled.
 * Returns the last observed value. On timeout it returns the current value instead of throwing,
 * leaving the final assertion to a subsequent {@link waitFor} call.
 */
export async function waitForSettled<T>(
	sample: () => Promise<T> | T,
	{ stableTimes = 3, interval = 500, timeout = 10_000 }: { stableTimes?: number; interval?: number; timeout?: number } = {},
): Promise<T> {
	const start = Date.now();
	let last = await sample();
	let stable = 1;
	for (;;) {
		await sleep(interval);
		const current = await sample();
		if (current === last) {
			stable += 1;
			if (stable >= stableTimes) return current;
		} else {
			stable = 1;
			last = current;
		}
		if (Date.now() - start >= timeout) return current;
	}
}

async function signin(
	host: Host,
	params: Misskey.entities.SigninFlowRequest,
): Promise<SigninResponse> {
	// wait for a second to prevent hit rate limit
	await sleep(1000);

	return await (new Misskey.api.APIClient({ origin: `https://${host}` }).request as Request)('signin-flow', params)
		.then(res => {
			strictEqual(res.finished, true);
			if (params.username === ADMIN_PARAMS.username) ADMIN_CACHE.set(host, res);
			return res;
		})
		.then(({ id, i }) => ({ id, i }))
		.catch(async err => {
			if (err.code === 'TOO_MANY_AUTHENTICATION_FAILURES') {
				await sleep(Math.random() * 2000);
				return await signin(host, params);
			}
			throw err;
		});
}

async function createAdmin(host: Host): Promise<Misskey.entities.SignupResponse | undefined> {
	const client = new Misskey.api.APIClient({ origin: `https://${host}` });
	return await client.request('admin/accounts/create', ADMIN_PARAMS).then(res => {
		ADMIN_CACHE.set(host, {
			id: res.id,
			i: res.token,
		});
		return res as Misskey.entities.SignupResponse;
	}).then(async res => {
		await client.request('admin/roles/update-default-policies', {
			policies: {
				/** TODO: @see https://github.com/misskey-dev/misskey/issues/14169 */
				rateLimitFactor: 0 as never,
			},
		}, res.token);
		await client.request('admin/update-meta', {
			federation: 'all',
		}, res.token);
		return res;
	}).catch(err => {
		if (err.info.e.message === 'access denied') return undefined;
		throw err;
	});
}

export async function fetchAdmin(host: Host): Promise<LoginUser> {
	const admin = ADMIN_CACHE.get(host) ?? await signin(host, ADMIN_PARAMS)
		.catch(async err => {
			if (err.id === '6cc579cc-885d-43d8-95c2-b8c7fc963280') {
				await createAdmin(host);
				return await signin(host, ADMIN_PARAMS);
			}
			throw err;
		});

	return {
		...admin,
		client: new Misskey.api.APIClient({ origin: `https://${host}`, credential: admin.i }),
		...ADMIN_PARAMS,
	};
}

export async function createAccount(host: Host): Promise<LoginUser> {
	const username = crypto.randomUUID().replaceAll('-', '').substring(0, 20);
	const password = crypto.randomUUID().replaceAll('-', '');
	const admin = await fetchAdmin(host);
	await admin.client.request('admin/accounts/create', { username, password });
	const signinRes = await signin(host, { username, password });

	return {
		...signinRes,
		client: new Misskey.api.APIClient({ origin: `https://${host}`, credential: signinRes.i }),
		username,
		password,
	};
}

export async function createModerator(host: Host): Promise<LoginUser> {
	const user = await createAccount(host);
	const role = await createRole(host, {
		name: 'Moderator',
		isModerator: true,
	});
	const admin = await fetchAdmin(host);
	await admin.client.request('admin/roles/assign', { roleId: role.id, userId: user.id });
	return user;
}

export async function createRole(
	host: Host,
	params: Partial<Misskey.entities.AdminRolesCreateRequest> = {},
): Promise<Misskey.entities.Role> {
	const admin = await fetchAdmin(host);
	return await admin.client.request('admin/roles/create', {
		name: 'Some role',
		description: 'Role for testing',
		color: null,
		iconUrl: null,
		target: 'conditional',
		condFormula: {},
		isPublic: true,
		isModerator: false,
		isAdministrator: false,
		isExplorable: true,
		asBadge: false,
		canEditMembersByModerator: false,
		displayOrder: 0,
		policies: {},
		...params,
	});
}

export async function resolveRemoteUser(
	host: Host,
	id: string,
	from: LoginUser,
): Promise<Misskey.entities.UserDetailedNotMe> {
	const uri = `https://${host}/users/${id}`;
	return await from.client.request('ap/show', { uri })
		.then(res => {
			strictEqual(res.type, 'User');
			strictEqual(res.object.uri, uri);
			return res.object;
		});
}

export async function resolveRemoteNote(
	host: Host,
	id: string,
	from: LoginUser,
): Promise<Misskey.entities.Note> {
	const uri = `https://${host}/notes/${id}`;
	return await from.client.request('ap/show', { uri })
		.then(res => {
			strictEqual(res.type, 'Note');
			strictEqual(res.object.uri, uri);
			return res.object;
		});
}

export async function resolveFederationTestNote(
	viewer: LoginUser,
	notePath: string,
	targetHost: FederationTestTargetHost = 'b.test',
): Promise<Misskey.entities.Note> {
	await deliverFederationTestNote(targetHost, notePath);
	return await waitForFederationTestNote(viewer, notePath);
}

export async function fetchRemoteEmojiByName(
	viewer: LoginUser,
	name: string,
	host: Host = FEDERATION_STUB_HOST,
): Promise<Misskey.entities.EmojiDetailed> {
	return await viewer.client.request('emoji', { name, host });
}

/**
 * リモート絵文字が DB に登録されていることを検証する。
 * #1049 未修正時は extractEmojis が失敗して絵文字だけ未登録になる（ノート受信は成功する）ため、
 * 長いポーリングではなく短い待機のあと明確なエラーで落とす。
 */
export async function requireRemoteEmoji(
	viewer: LoginUser,
	name: string,
	host: Host = FEDERATION_STUB_HOST,
	options?: { timeout?: number },
): Promise<Misskey.entities.EmojiDetailed> {
	let emoji: Misskey.entities.EmojiDetailed | undefined;
	const timeout = options?.timeout ?? 3_000;
	await waitFor(async () => {
		try {
			emoji = await fetchRemoteEmojiByName(viewer, name, host);
			return true;
		} catch {
			return false;
		}
	}, { timeout, interval: 300 });
	if (emoji == null) {
		throw new Error(
			`リモート絵文字が未登録: ${name}@${host}。` +
			'ノート受信後も絵文字が登録されない場合、#1049 未修正で extractEmojis が DB 制約違反により失敗している可能性があります（TDD 想定の失敗）。' +
			'ノート自体が取り込まれていない場合は inbox 配送または z.test への到達性を確認してください。',
		);
	}
	return emoji;
}

export async function waitForRemoteEmoji(
	viewer: LoginUser,
	name: string,
	host: Host = FEDERATION_STUB_HOST,
	options?: { timeout?: number },
): Promise<Misskey.entities.EmojiDetailed> {
	let emoji: Misskey.entities.EmojiDetailed | undefined;
	await waitFor(async () => {
		try {
			emoji = await fetchRemoteEmojiByName(viewer, name, host);
			return true;
		} catch {
			return false;
		}
	}, options);
	if (emoji == null) {
		throw new Error(`remote emoji not found: ${name}@${host} (note may be ingested but emoji was not registered)`);
	}
	return emoji;
}

export async function uploadFile(
	host: Host,
	user: { i: string },
	path = '../../test/resources/192.jpg',
): Promise<Misskey.entities.DriveFile> {
	const filename = path.split('/').pop() ?? 'untitled';
	const buffer = await readFile(join(__dirname, path));
	const blob = new Blob([new Uint8Array(buffer)]);

	const body = new FormData();
	body.append('i', user.i);
	body.append('force', 'true');
	body.append('file', blob);
	body.append('name', filename);

	return await fetch(`https://${host}/api/drive/files/create`, { method: 'POST', body })
		.then(async res => await res.json());
}

export async function addCustomEmoji(
	host: Host,
	param?: Partial<Misskey.entities.AdminEmojiAddRequest>,
	path?: string,
): Promise<Misskey.entities.EmojiDetailed> {
	const admin = await fetchAdmin(host);
	const name = crypto.randomUUID().replaceAll('-', '');
	const file = await uploadFile(host, admin, path);
	return await admin.client.request('admin/emoji/add', { name, fileId: file.id, ...param });
}

export function deepStrictEqualWithExcludedFields<T>(actual: T, expected: T, excludedFields: (keyof T)[]) {
	const _actual = structuredClone(actual);
	const _expected = structuredClone(expected);
	for (const obj of [_actual, _expected]) {
		for (const field of excludedFields) {
			delete obj[field];
		}
	}
	deepStrictEqual(_actual, _expected);
}

export async function isFired<C extends keyof Misskey.Channels, T extends keyof Misskey.Channels[C]['events']>(
	host: Host,
	user: { i: string },
	channel: C,
	trigger: () => Promise<unknown>,
	type: T,
	// @ts-expect-error TODO: why getting error here?
	cond: (msg: Parameters<Misskey.Channels[C]['events'][T]>[0]) => boolean,
	params?: Misskey.Channels[C]['params'],
): Promise<boolean> {
	return new Promise<boolean>(async (resolve, reject) => {
		const stream = new Misskey.Stream(`wss://${host}`, { token: user.i }, { WebSocket });
		const connection = stream.useChannel(channel, params);
		connection.on(type as any, ((msg: any) => {
			if (cond(msg)) {
				stream.close();
				clearTimeout(timer);
				resolve(true);
			}
		}) as any);

		let timer: NodeJS.Timeout | undefined;

		await trigger().then(() => {
			timer = setTimeout(() => {
				stream.close();
				resolve(false);
			}, 500);
		}).catch(err => {
			stream.close();
			clearTimeout(timer);
			reject(err);
		});
	});
};

export async function isNoteUpdatedEventFired(
	host: Host,
	user: { i: string },
	noteId: string,
	trigger: () => Promise<unknown>,
	cond: (msg: Parameters<Misskey.StreamEvents['noteUpdated']>[0]) => boolean,
): Promise<boolean> {
	return new Promise<boolean>(async (resolve, reject) => {
		const stream = new Misskey.Stream(`wss://${host}`, { token: user.i }, { WebSocket });
		stream.send('s', { id: noteId });
		stream.on('noteUpdated', msg => {
			if (cond(msg)) {
				stream.close();
				clearTimeout(timer);
				resolve(true);
			}
		});

		let timer: NodeJS.Timeout | undefined;

		await trigger().then(() => {
			timer = setTimeout(() => {
				stream.close();
				resolve(false);
			}, 500);
		}).catch(err => {
			stream.close();
			clearTimeout(timer);
			reject(err);
		});
	});
};

export async function assertNotificationReceived(
	receiverHost: Host,
	receiver: LoginUser,
	trigger: () => Promise<unknown>,
	cond: (notification: Misskey.entities.Notification) => boolean,
	expect: boolean,
) {
	const streamingFired = await isFired(receiverHost, receiver, 'main', trigger, 'notification', cond);
	strictEqual(streamingFired, expect);

	const endpointFired = await receiver.client.request('i/notifications', {})
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		.then(([notification]) => notification != null ? cond(notification) : false);
	strictEqual(endpointFired, expect);
}
