/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeAll, afterAll, test, vi } from 'vitest';
import type { Mock } from 'vitest';

import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { IdService } from '@/core/IdService.js';
import { QueueService } from '@/core/QueueService.js';
import { ApInboxService } from '@/core/activitypub/ApInboxService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { MiNote } from '@/models/Note.js';
import type { MiRemoteUser } from '@/models/User.js';
import type { BlockingsRepository, FollowingsRepository, NotesRepository, QuoteAuthorizationsRepository, UsersRepository } from '@/models/_.js';
import { randomString } from '../utils.js';

describe('ApInboxService (QuoteRequest)', () => {
	let app: TestingModule;
	let apInboxService: ApInboxService;
	let apRendererService: ApRendererService;
	let config: Config;
	let usersRepository: UsersRepository;
	let notesRepository: NotesRepository;
	let blockingsRepository: BlockingsRepository;
	let followingsRepository: FollowingsRepository;
	let quoteAuthorizationsRepository: QuoteAuthorizationsRepository;
	let idService: IdService;
	let deliverMock: Mock;

	const remoteHost = `quote-${randomString(undefined, 6).toLowerCase()}.test`;
	const instrumentBase = `https://${remoteHost}/notes`;

	let authorId: string;
	let publicNote: MiNote;
	let homeNote: MiNote;
	let followersNote: MiNote;
	let localOnlyNote: MiNote;
	let localOnlyFollowersNote: MiNote;
	let remoteActor: MiRemoteUser;
	let sameHostActor: MiRemoteUser;
	let blockedActor: MiRemoteUser;

	async function createLocalUser(): Promise<string> {
		const username = `qra${randomString(undefined, 8).toLowerCase()}`;
		const res = await usersRepository.insert({
			id: idService.gen(),
			username,
			usernameLower: username.toLowerCase(),
		});
		return res.identifiers[0].id as string;
	}

	async function createRemoteUser(): Promise<MiRemoteUser> {
		const username = `qrb${randomString(undefined, 8).toLowerCase()}`;
		const uri = `https://${remoteHost}/users/${username}`;
		const res = await usersRepository.insert({
			id: idService.gen(),
			username,
			usernameLower: username.toLowerCase(),
			host: remoteHost,
			uri,
			inbox: `${uri}/inbox`,
			lastFetchedAt: new Date(),
		});
		return await usersRepository.findOneByOrFail({ id: res.identifiers[0].id }) as MiRemoteUser;
	}

	async function createNote(visibility: MiNote['visibility'], localOnly: boolean): Promise<MiNote> {
		const res = await notesRepository.insert({
			id: idService.gen(),
			userId: authorId,
			text: 'test',
			visibility: visibility,
			localOnly: localOnly,
		});
		return await notesRepository.findOneByOrFail({ id: res.identifiers[0].id });
	}

	function buildQuoteRequest(objectUri: string, instrument: string | unknown, actor: MiRemoteUser = remoteActor): any {
		return {
			id: `https://${remoteHost}/activities/${randomString(undefined, 12)}`,
			type: 'QuoteRequest',
			actor: actor.uri,
			object: objectUri,
			instrument: instrument,
		};
	}

	function noteUri(note: MiNote): string {
		return `${config.url}/notes/${note.id}`;
	}

	// deliver の実際の内容 (Accept/Reject) を検証するために QueueService.deliver をスパイで抑える。
	// スパイなしだと存在しないホストへの配送ジョブを Redis/BullMQ に実積してしまう。
	function takeDelivers(): any[] {
		const calls = deliverMock.mock.calls.map((call: any[]) => ({
			user: call[0],
			content: call[1],
			to: call[2],
		}));
		deliverMock.mockClear();
		return calls;
	}

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		apInboxService = app.get<ApInboxService>(ApInboxService);
		apRendererService = app.get<ApRendererService>(ApRendererService);
		config = app.get<Config>(DI.config);
		usersRepository = app.get<UsersRepository>(DI.usersRepository);
		notesRepository = app.get<NotesRepository>(DI.notesRepository);
		blockingsRepository = app.get<BlockingsRepository>(DI.blockingsRepository);
		followingsRepository = app.get<FollowingsRepository>(DI.followingsRepository);
		quoteAuthorizationsRepository = app.get<QuoteAuthorizationsRepository>(DI.quoteAuthorizationsRepository);
		idService = app.get<IdService>(IdService);

		const queueService = app.get<QueueService>(QueueService);
		// @bindThis のプロトタイプ getter があるため vi.spyOn / 代入では上書きできないので
		// インスタンス側に data property として定義してモック化する。
		deliverMock = vi.fn();
		Reflect.defineProperty(queueService, 'deliver', {
			value: deliverMock,
			configurable: true,
			writable: true,
		});

		authorId = await createLocalUser();
		publicNote = await createNote('public', false);
		homeNote = await createNote('home', false);
		followersNote = await createNote('followers', false);
		localOnlyNote = await createNote('public', true);
		localOnlyFollowersNote = await createNote('followers', true);
		remoteActor = await createRemoteUser();
		sameHostActor = await createRemoteUser();
		blockedActor = await createRemoteUser();

		await blockingsRepository.insert({
			id: idService.gen(),
			blockerId: authorId,
			blockeeId: blockedActor.id,
		});
	}, 1000 * 60 * 2);

	afterAll(async () => {
		vi.restoreAllMocks();
		await app.close();
	});

	test('public なローカルノートへの QuoteRequest は受理され、Accept が承認URI付きで配送される', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const activity = buildQuoteRequest(noteUri(publicNote), instrument);
		const result = await apInboxService.performOneActivity(remoteActor, activity);

		assert.strictEqual(result, 'ok: quote request accepted');

		const row = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		assert.match(row.token, /^[A-Za-z0-9_-]+$/);
		assert.strictEqual(row.requestedById, remoteActor.id);

		const delivers = takeDelivers();
		assert.strictEqual(delivers.length, 1);
		const delivered = delivers[0];
		assert.strictEqual(delivered.to, remoteActor.inbox);
		assert.strictEqual(delivered.content.type, 'Accept');
		assert.strictEqual(delivered.content.actor, `${config.url}/users/${authorId}`);
		assert.strictEqual(delivered.content.object, activity.id);
		assert.strictEqual(delivered.content.result, `${config.url}/users/${authorId}/quote_authorizations/${row.token}`);
	});

	test('home なローカルノートへの QuoteRequest も受理され、承認行が作られる', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(homeNote), instrument));

		assert.strictEqual(result, 'ok: quote request accepted');

		const row = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: homeNote.id,
			interactingObject: instrument,
		});
		assert.match(row.token, /^[A-Za-z0-9_-]+$/);
		takeDelivers();
	});

	test('同一 (note, instrument) の再送では同じトークンが返り行は増えない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));
		const first = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		takeDelivers();

		await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));
		const second = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		const count = await quoteAuthorizationsRepository.countBy({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		takeDelivers();

		assert.strictEqual(first.token, second.token);
		assert.strictEqual(count, 1);
	});

	test('既存行と異なるアクターからの同一 instrument は受理されずトークンも漏れない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));
		const first = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		takeDelivers();

		const result = await apInboxService.performOneActivity(sameHostActor, buildQuoteRequest(noteUri(publicNote), instrument, sameHostActor));
		const delivers = takeDelivers();

		assert.strictEqual(result, 'skip: instrument is already used by another actor');
		assert.strictEqual(delivers.length, 0);
		const count = await quoteAuthorizationsRepository.countBy({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 1);
		assert.strictEqual(first.requestedById, remoteActor.id);
	});

	test('id が文字列でない QuoteRequest は skip される', async () => {
		const activity = buildQuoteRequest(noteUri(publicNote), `${instrumentBase}/${randomString(undefined, 8)}`);
		activity.id = undefined;
		const result = await apInboxService.performOneActivity(remoteActor, activity);

		assert.strictEqual(result, 'skip: QuoteRequest id is not a string');
		takeDelivers();
	});

	test('ローカルノートでない object は skip される', async () => {
		const remoteNoteUri = `${instrumentBase}/${randomString(undefined, 8)}`;
		await notesRepository.insert({
			id: idService.gen(),
			userId: remoteActor.id,
			text: 'remote',
			visibility: 'public',
			userHost: remoteHost,
			uri: remoteNoteUri,
		});

		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(remoteNoteUri, `${instrumentBase}/${randomString(undefined, 8)}`));

		assert.strictEqual(result, 'skip: quoted note is not a local note');
		takeDelivers();
	});

	test('instrument が決定不能 (配列) な場合は skip される', async () => {
		const result = await apInboxService.performOneActivity(
			remoteActor,
			buildQuoteRequest(noteUri(publicNote), ['https://a.example.com/x', 'https://b.example.com/y']),
		);

		assert.strictEqual(result, 'skip: cannot determine instrument');
		takeDelivers();
	});

	test('存在しないノートは skip される', async () => {
		const result = await apInboxService.performOneActivity(
			remoteActor,
			buildQuoteRequest(`${config.url}/notes/${idService.gen()}`, `${instrumentBase}/${randomString(undefined, 8)}`),
		);
		assert.strictEqual(result, 'skip: quoted note not found');
		takeDelivers();
	});

	test('フォロワー限定ノートは skip され Reject は配送されず行が残らない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const activity = buildQuoteRequest(noteUri(followersNote), instrument);
		const result = await apInboxService.performOneActivity(remoteActor, activity);

		assert.strictEqual(result, 'skip: quoted note is not publicly readable');

		// 公開範囲が理由の拒否は Reject を配送しない (非公開投稿の存在漏洩防止)
		assert.strictEqual(takeDelivers().length, 0);

		const count = await quoteAuthorizationsRepository.countBy({
			noteId: followersNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
	});

	test('localOnly ノートは skip され Reject が配送され行が残らない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const activity = buildQuoteRequest(noteUri(localOnlyNote), instrument);
		const result = await apInboxService.performOneActivity(remoteActor, activity);

		assert.strictEqual(result, 'skip: quoted note is localOnly');

		const delivers = takeDelivers();
		assert.strictEqual(delivers.length, 1);
		assert.strictEqual(delivers[0].content.type, 'Reject');

		const count = await quoteAuthorizationsRepository.countBy({
			noteId: localOnlyNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
	});

	test('ノート作者にブロックされているアクターは skip され Reject が配送され行が残らない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const activity = buildQuoteRequest(noteUri(publicNote), instrument, blockedActor);
		const result = await apInboxService.performOneActivity(blockedActor, activity);

		assert.strictEqual(result, 'skip: actor is blocked by the quoted note author');

		const delivers = takeDelivers();
		assert.strictEqual(delivers.length, 1);
		assert.strictEqual(delivers[0].content.type, 'Reject');

		const count = await quoteAuthorizationsRepository.countBy({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
	});

	test('作者が凍結済み・削除済みのノートは skip され Reject も返さない', async () => {
		const instrument1 = `${instrumentBase}/${randomString(undefined, 8)}`;
		const instrument2 = `${instrumentBase}/${randomString(undefined, 8)}`;

		await usersRepository.update({ id: authorId }, { isSuspended: true });
		const suspendedResult = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument1));
		await usersRepository.update({ id: authorId }, { isSuspended: false });

		await usersRepository.update({ id: authorId }, { isDeleted: true });
		const deletedResult = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument2));
		await usersRepository.update({ id: authorId }, { isDeleted: false });

		assert.strictEqual(suspendedResult, 'skip: quoted note author is suspended or deleted');
		assert.strictEqual(deletedResult, 'skip: quoted note author is suspended or deleted');

		const delivers = takeDelivers();
		assert.strictEqual(delivers.length, 0);
	});

	test('instrument がアクターのホストと異る場合は skip される', async () => {
		const result = await apInboxService.performOneActivity(
			remoteActor,
			buildQuoteRequest(noteUri(publicNote), 'https://other.example.com/notes/12345678'),
		);
		assert.strictEqual(result, 'skip: instrument host mismatch');
		takeDelivers();
	});

	test('instrument がバイト上限を超えると skip され行が残らない', async () => {
		// 文字数は 512 文字未満でも UTF-8 バイト数が上限を超えれば skip する
		const instrument = `https://${remoteHost}/${'あ'.repeat(200)}`;
		assert.ok(instrument.length < 512);
		assert.ok(Buffer.byteLength(instrument, 'utf8') > 512);
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));

		assert.strictEqual(result, 'skip: instrument uri is too long');
		const count = await quoteAuthorizationsRepository.countBy({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
		takeDelivers();
	});

	test('フォロワーからのフォロワー限定ノートへの QuoteRequest は黙殺せず Reject を配送する', async () => {
		await followingsRepository.insert({
			id: idService.gen(),
			followerId: remoteActor.id,
			followeeId: authorId,
			followerHost: remoteActor.host,
			followeeHost: null,
		});

		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(followersNote), instrument));

		assert.strictEqual(result, 'skip: quoted note is not publicly readable');

		const delivers = takeDelivers();
		assert.strictEqual(delivers.length, 1);
		assert.strictEqual(delivers[0].content.type, 'Reject');

		const count = await quoteAuthorizationsRepository.countBy({
			noteId: followersNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
	});

	test('localOnly かつフォロワー限定のノートは閲覧でない相手には黙殺され Reject も配送されない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(sameHostActor, buildQuoteRequest(noteUri(localOnlyFollowersNote), instrument, sameHostActor));

		assert.strictEqual(result, 'skip: quoted note is not publicly readable');
		assert.strictEqual(takeDelivers().length, 0);

		const count = await quoteAuthorizationsRepository.countBy({
			noteId: localOnlyFollowersNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
	});

	test('instrument にデフォルトポートを明示した URI もホスト一致として受理される', async () => {
		const instrument = `https://${remoteHost}:443/notes/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));

		assert.strictEqual(result, 'ok: quote request accepted');
		takeDelivers();
	});

	test('バイト上限直下の圧縮されない instrument で受理され行が残る', async () => {
		const instrument = `https://${remoteHost}/notes/${randomString(undefined, 470)}`;
		const bytes = Buffer.byteLength(instrument, 'utf8');
		assert.ok(bytes > 480);
		assert.ok(bytes <= 512);

		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));
		assert.strictEqual(result, 'ok: quote request accepted');

		const row = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		assert.match(row.token, /^[A-Za-z0-9_-]+$/);
		takeDelivers();
	});

	test('renderQuoteAuthorization は FEP-044f 形の QuoteAuthorization を返す', () => {
		const approvalUri = `${config.url}/users/${authorId}/quote_authorizations/sometoken`;
		const interactingObject = `${instrumentBase}/abcdef12`;
		const rendered = apRendererService.renderQuoteAuthorization(
			approvalUri,
			{ id: authorId, host: null },
			interactingObject,
			noteUri(publicNote),
		);

		assert.strictEqual(rendered.id, approvalUri);
		assert.strictEqual(rendered.type, 'QuoteAuthorization');
		assert.strictEqual(rendered.attributedTo, `${config.url}/users/${authorId}`);
		assert.strictEqual(rendered.interactingObject, interactingObject);
		assert.strictEqual(rendered.interactionTarget, noteUri(publicNote));
	});
});
