import { describe, test, beforeAll } from 'vitest';
import { strictEqual } from 'node:assert';
import {
	assertFederationTestNoteNotIngested,
	createAccount,
	deliverFederationTestNote,
	sleep,
	waitForFederationTestNoteUri,
	type FederationTestHttpMode,
	type FederationTestLdMode,
	type LoginUser,
} from './utils.js';

type LdCase = {
	notePath: string;
	ld: FederationTestLdMode;
	http: FederationTestHttpMode;
	activityId?: string;
};

async function deliverLdCase(
	viewer: LoginUser,
	recipient: string,
	c: LdCase,
): Promise<{ noteUri: string; activityId: string }> {
	const nonce = crypto.randomUUID().replaceAll('-', '');
	const noteUri = `https://z.test/notes/json-ld-signature/${nonce}`;
	const delivered = await deliverFederationTestNote('b.test', c.notePath, {
		placeholders: { nonce, recipient },
		ld: c.ld,
		http: c.http,
		activityId: c.activityId,
	});
	return { noteUri, activityId: delivered.activityId };
}

describe('JsonLD署名検証', () => {
	let bob: LoginUser;
	let recipient: string;

	beforeAll(async () => {
		bob = await createAccount('b.test');
		recipient = `https://b.test/users/${bob.id}`;
		await sleep();
	});

	describe('取り込まれるケース', () => {
		test('HTTP署名のみ (LDなし) は取り込まれる', async () => {
			const { noteUri } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/02-public-only',
				ld: 'none',
				http: 'valid',
			});
			const note = await waitForFederationTestNoteUri(bob, noteUri);
			strictEqual(note.uri, noteUri);
		});

		test('HTTP有効+LD有効 (self言及あり) は取り込まれる', async () => {
			const { noteUri } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'valid',
				http: 'valid',
			});
			const note = await waitForFederationTestNoteUri(bob, noteUri);
			strictEqual(note.uri, noteUri);
		});

		test('HTTP有効+LD有効 (self言及なし) はLDを剥がして取り込まれる', async () => {
			const { noteUri } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/02-public-only',
				ld: 'valid',
				http: 'valid',
			});
			const note = await waitForFederationTestNoteUri(bob, noteUri);
			strictEqual(note.uri, noteUri);
		});

		test('HTTP破壊+LD有効 はLDフォールバックで取り込まれる', async () => {
			const { noteUri } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'valid',
				http: 'broken',
			});
			const note = await waitForFederationTestNoteUri(bob, noteUri);
			strictEqual(note.uri, noteUri);
		});

		test('HTTP有効+LD改ざん はLDを剥がして取り込まれる', async () => {
			const { noteUri } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'tampered-body',
				http: 'valid',
			});
			const note = await waitForFederationTestNoteUri(bob, noteUri);
			strictEqual(note.uri, noteUri);
		});
	});

	describe('拒否されるケース', () => {
		async function assertRejected(noteUri: string, activityId: string): Promise<void> {
			await assertFederationTestNoteNotIngested(bob, noteUri, {
				inbox: { host: 'b.test', activityId, expect: 'failed' },
			});
		}

		test('HTTP破壊+LDなし は拒否される', async () => {
			const { noteUri, activityId } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'none',
				http: 'broken',
			});
			await assertRejected(noteUri, activityId);
		});

		test('HTTP破壊+LD本文改ざん は拒否される', async () => {
			const { noteUri, activityId } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'tampered-body',
				http: 'broken',
			});
			await assertRejected(noteUri, activityId);
		});

		test('HTTP破壊+LD署名値改ざん は拒否される', async () => {
			const { noteUri, activityId } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'tampered-value',
				http: 'broken',
			});
			await assertRejected(noteUri, activityId);
		});

		test('HTTP破壊+LD型不正 は拒否される', async () => {
			const { noteUri, activityId } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'wrong-type',
				http: 'broken',
			});
			await assertRejected(noteUri, activityId);
		});

		test('HTTP破壊+LD creator不一致 (mallory署名) は拒否される', async () => {
			const { noteUri, activityId } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'creator-mismatch',
				http: 'broken',
			});
			await assertRejected(noteUri, activityId);
		});

		test('activity.idホスト不一致 は拒否される', async () => {
			const { noteUri, activityId } = await deliverLdCase(bob, recipient, {
				notePath: 'json-ld-signature/01-mention-self',
				ld: 'valid',
				http: 'valid',
				activityId: 'https://evil.test/activities/create/json-ld-signature#forged',
			});
			await assertRejected(noteUri, activityId);
		});
	});
});
