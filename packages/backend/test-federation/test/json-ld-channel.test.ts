import assert, { strictEqual } from 'node:assert';
import { describe, test, beforeAll } from 'vitest';
import type * as Misskey from 'misskey-js';
import {
	assertFederationTestNoteNotIngested,
	createAccount,
	deliverFederationTestNote,
	findInboxJobWithGrace,
	randomUsername,
	resolveRemoteUser,
	sleep,
	waitFor,
	waitForFederationTestNoteUri,
	waitForInboxJobSettled,
	type FederationTestHttpMode,
	type FederationTestLdMode,
	type LoginUser,
} from './utils.js';

const ORIGINAL_PATH = 'json-ld-signature/10-ch-original';
const ORIGINAL_URI = 'https://z.test/notes/json-ld-signature/10-ch-original';
const ANNOUNCE_PATH = 'json-ld-signature/11-ch-announce';

describe('JsonLD署名検証 (チャンネル投稿)', () => {
	let alice: LoginUser;
	let aliceCh: Misskey.entities.Channel;
	let channelActorUri: string;

	beforeAll(async () => {
		alice = await createAccount('a.test');
		aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId);
		channelActorUri = `https://a.test/users/${aliceCh.actorId}`;
		await sleep();
	});

	async function deliverChannelNote(options: { ld: FederationTestLdMode; http: FederationTestHttpMode }): Promise<{ noteUri: string; activityId: string; }> {
		const nonce = crypto.randomUUID().replaceAll('-', '');
		const noteUri = `https://z.test/notes/json-ld-signature/${nonce}`;
		const delivered = await deliverFederationTestNote('a.test', 'json-ld-signature/01-mention-self', {
			placeholders: { nonce, recipient: channelActorUri },
			ld: options.ld,
			http: options.http,
		});
		return { noteUri, activityId: delivered.activityId };
	}

	async function deliverChannelAnnounce(options: { ld: FederationTestLdMode; http: FederationTestHttpMode }): Promise<string> {
		// Announce 対象のオリジナルを先に取り込ませる (再配送は重複スキップされ安全)
		await deliverFederationTestNote('a.test', ORIGINAL_PATH);
		await waitForFederationTestNoteUri(alice, ORIGINAL_URI);

		const delivered = await deliverFederationTestNote('a.test', ANNOUNCE_PATH, {
			placeholders: { channelActor: channelActorUri },
			ld: options.ld,
			http: options.http,
		});
		return delivered.activityId;
	}

	// b.test (受信側) の inbox ジョブで中継の有無を判定する。
	// 偽LD付き Announce が中継されると b.test に届き、LD検証で拒否されて failed ジョブが残る。
	// 正規LDプローブが b.test で受理 (completed) されるのをフェンスにしてから、
	// 対象のジョブが現れないことを確認する。
	async function assertNotRelayedAtB(activityId: string): Promise<void> {
		const probe = await deliverChannelAnnounce({ ld: 'valid', http: 'valid' });
		const probeJob = await waitForInboxJobSettled('b.test', probe, { timeout: 60_000 });
		strictEqual(
			probeJob.state,
			'completed',
			`valid relay was not accepted by b.test: ${probeJob.failedReason ?? ''}`,
		);

		// deliver ワーカーの並行処理由来の配送順序の揺らぎを吸収する猶予付きで確認する
		const targetJob = await findInboxJobWithGrace('b.test', activityId, 10_000);
		if (targetJob != null) {
			throw new Error(`note should not have been relayed but was: ${activityId} (b.test inbox ${targetJob.state}: ${targetJob.failedReason ?? ''})`);
		}
	}

	describe('チャンネル宛Create', () => {
		test('HTTP署名のみ (LDなし) はチャンネル投稿として取り込まれる', async () => {
			const { noteUri } = await deliverChannelNote({ ld: 'none', http: 'valid' });
			const note = await waitForFederationTestNoteUri(alice, noteUri);
			strictEqual(note.channelId, aliceCh.id);
		});

		test('HTTP有効+LD有効 はチャンネル投稿として取り込まれる', async () => {
			const { noteUri } = await deliverChannelNote({ ld: 'valid', http: 'valid' });
			const note = await waitForFederationTestNoteUri(alice, noteUri);
			strictEqual(note.channelId, aliceCh.id);
		});

		test('HTTP破壊+LD有効 はLDフォールバックでチャンネル投稿として取り込まれる', async () => {
			const { noteUri } = await deliverChannelNote({ ld: 'valid', http: 'broken' });
			const note = await waitForFederationTestNoteUri(alice, noteUri);
			strictEqual(note.channelId, aliceCh.id);
		});

		test('HTTP有効+LD改ざん はLDを剥がしてチャンネル投稿として取り込まれる', async () => {
			// NOTE: 現ブランチはHTTP有効時にLD不検証のまま継続し、Create経路には転送がないため取り込まれる (現行仕様の固定)
			const { noteUri } = await deliverChannelNote({ ld: 'tampered-body', http: 'valid' });
			const note = await waitForFederationTestNoteUri(alice, noteUri);
			strictEqual(note.channelId, aliceCh.id);
		});

		test('HTTP破壊+LDなし は拒否される', async () => {
			const { noteUri, activityId } = await deliverChannelNote({ ld: 'none', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, noteUri, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});

		test('HTTP破壊+LD本文改ざん は拒否される', async () => {
			const { noteUri, activityId } = await deliverChannelNote({ ld: 'tampered-body', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, noteUri, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});

		test('HTTP破壊+LD署名値改ざん は拒否される', async () => {
			const { noteUri, activityId } = await deliverChannelNote({ ld: 'tampered-value', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, noteUri, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});

		test('HTTP破壊+LD型不正 は拒否される', async () => {
			const { noteUri, activityId } = await deliverChannelNote({ ld: 'wrong-type', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, noteUri, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});

		test('HTTP破壊+LD creator不一致 (mallory署名) は拒否される', async () => {
			const { noteUri, activityId } = await deliverChannelNote({ ld: 'creator-mismatch', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, noteUri, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});
	});

	describe('チャンネル宛Announce', () => {
		test('HTTP有効+LD有効 はチャンネルリノートとして取り込まれる', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'valid', http: 'valid' });
			const renote = await waitForFederationTestNoteUri(alice, activityId);
			strictEqual(renote.channelId, aliceCh.id);
			assert(renote.renoteId != null);

			const tl = await alice.client.request('channels/timeline', { channelId: aliceCh.id, limit: 20 });
			assert(tl.some(note => note.id === renote.id), 'チャンネルTLにリノートが流れる');
		});

		test('HTTP破壊+LD有効 はLDフォールバックでチャンネルリノートとして取り込まれる', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'valid', http: 'broken' });
			const renote = await waitForFederationTestNoteUri(alice, activityId);
			strictEqual(renote.channelId, aliceCh.id);
			assert(renote.renoteId != null);
		});

		test('HTTP破壊+LDなし は拒否される', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'none', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, activityId, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});

		test('HTTP破壊+LD本文改ざん は拒否される', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'tampered-body', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, activityId, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});

		test('HTTP破壊+LD型不正 は拒否される', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'wrong-type', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, activityId, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});

		test('HTTP破壊+LD署名値改ざん は拒否される', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'tampered-value', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, activityId, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});

		test('HTTP破壊+LD creator不一致 (mallory署名) は拒否される', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'creator-mismatch', http: 'broken' });
			await assertFederationTestNoteNotIngested(alice, activityId, {
				inbox: { host: 'a.test', activityId, expect: 'failed' },
			});
		});
	});

	describe('チャンネルフォロワーへの中継 (fan-out)', () => {
		let bob: LoginUser;

		async function waitForTimelineUri(viewer: LoginUser, uri: string, timeout = 60_000): Promise<Misskey.entities.Note> {
			let found: Misskey.entities.Note | undefined;
			await waitFor(async () => {
				try {
					const tl = await viewer.client.request('notes/timeline', { limit: 100 });
					found = tl.find(note => note.uri === uri);
					return found != null;
				} catch {
					return false;
				}
			}, { timeout, interval: 250 });
			if (found == null) throw new Error(`relayed note not observed in timeline: ${uri}`);
			return found;
		}

		beforeAll(async () => {
			bob = await createAccount('b.test');
			const zackInB = await resolveRemoteUser('z.test', 'zack', bob);
			await bob.client.request('following/create', { userId: zackInB.id });
			assert(aliceCh.actorId);
			const chActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			assert(chActorInB.channelId);
			const aliceChInB = await bob.client.request('channels/show', { channelId: chActorInB.channelId });
			await bob.client.request('channels/follow', { channelId: aliceChInB.id });
			await waitFor(async () => {
				const channelActor = await bob.client.request('users/show', { userId: chActorInB.id });
				return channelActor.isFollowing ?? false;
			}, { timeout: 30_000, interval: 1_000 });
		});

		test('HTTP有効+LD有効 のAnnounceはフォロワーのサーバーへ中継される', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'valid', http: 'valid' });
			const renote = await waitForFederationTestNoteUri(alice, activityId);
			strictEqual(renote.channelId, aliceCh.id);

			const relayed = await waitForTimelineUri(bob, activityId);
			strictEqual(relayed.uri, activityId);
		});

		test('HTTP有効+LD改ざん のAnnounceは取り込まれるが中継されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'tampered-body', http: 'valid' });
			const renote = await waitForFederationTestNoteUri(alice, activityId);
			strictEqual(renote.channelId, aliceCh.id);

			await assertNotRelayedAtB(activityId);
		});

		test('HTTP有効+LD署名値改ざん のAnnounceは取り込まれるが中継されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'tampered-value', http: 'valid' });
			const renote = await waitForFederationTestNoteUri(alice, activityId);
			strictEqual(renote.channelId, aliceCh.id);

			await assertNotRelayedAtB(activityId);
		});

		test('HTTP有効+LD型不正 のAnnounceは取り込まれるが中継されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'wrong-type', http: 'valid' });
			const renote = await waitForFederationTestNoteUri(alice, activityId);
			strictEqual(renote.channelId, aliceCh.id);

			await assertNotRelayedAtB(activityId);
		});

		test('HTTP有効+LD creator不一致 のAnnounceは取り込まれるが中継されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'creator-mismatch', http: 'valid' });
			const renote = await waitForFederationTestNoteUri(alice, activityId);
			strictEqual(renote.channelId, aliceCh.id);

			await assertNotRelayedAtB(activityId);
		});

		test('HTTP有効+LDなし のAnnounceは取り込まれるが中継されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'none', http: 'valid' });
			const renote = await waitForFederationTestNoteUri(alice, activityId);
			strictEqual(renote.channelId, aliceCh.id);

			await assertNotRelayedAtB(activityId);
		});
	});

	describe('中継の観測 (b.test受信)', () => {
		// 中継の有無は受信側 b.test の inbox ジョブで判定する (assertNotRelayedAtB)。
		// 偽LD付き Announce が中継されると b.test に届き、LD検証で拒否されて failed ジョブが残る。
		// 正規LDが中継されることの観測路 sanity は assertNotRelayedAtB 内のプローブで担保する。

		test('改竄LDのAnnounceの中継トラフィックは観測されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'tampered-body', http: 'valid' });
			await waitForFederationTestNoteUri(alice, activityId);
			await assertNotRelayedAtB(activityId);
		});

		test('LDなしAnnounceの中継トラフィックは観測されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'none', http: 'valid' });
			await waitForFederationTestNoteUri(alice, activityId);
			await assertNotRelayedAtB(activityId);
		});

		test('型不正LDのAnnounceの中継トラフィックは観測されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'wrong-type', http: 'valid' });
			await waitForFederationTestNoteUri(alice, activityId);
			await assertNotRelayedAtB(activityId);
		});

		test('creator不一致LDのAnnounceの中継トラフィックは観測されない', async () => {
			const activityId = await deliverChannelAnnounce({ ld: 'creator-mismatch', http: 'valid' });
			await waitForFederationTestNoteUri(alice, activityId);
			await assertNotRelayedAtB(activityId);
		});
	});
});
