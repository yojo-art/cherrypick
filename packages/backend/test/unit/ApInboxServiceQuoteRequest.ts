/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeAll, afterAll, test } from 'vitest';

import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { IdService } from '@/core/IdService.js';
import { ApInboxService } from '@/core/activitypub/ApInboxService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { MiNote } from '@/models/Note.js';
import type { MiRemoteUser } from '@/models/User.js';
import type { BlockingsRepository, NotesRepository, QuoteAuthorizationsRepository, UsersRepository } from '@/models/_.js';
import { randomString } from '../utils.js';

describe('ApInboxService (QuoteRequest)', () => {
	let app: TestingModule;
	let apInboxService: ApInboxService;
	let apRendererService: ApRendererService;
	let config: Config;
	let usersRepository: UsersRepository;
	let notesRepository: NotesRepository;
	let blockingsRepository: BlockingsRepository;
	let quoteAuthorizationsRepository: QuoteAuthorizationsRepository;
	let idService: IdService;

	const remoteHost = `quote-${randomString(undefined, 6).toLowerCase()}.test`;
	const instrumentBase = `https://${remoteHost}/notes`;

	let authorId: string;
	let publicNote: MiNote;
	let homeNote: MiNote;
	let followersNote: MiNote;
	let localOnlyNote: MiNote;
	let remoteActor: MiRemoteUser;
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

	function buildQuoteRequest(objectUri: string, instrument: string): any {
		return {
			id: `https://${remoteHost}/activities/${randomString(undefined, 12)}`,
			type: 'QuoteRequest',
			actor: remoteActor.uri,
			object: objectUri,
			instrument: instrument,
		};
	}

	function noteUri(note: MiNote): string {
		return `${config.url}/notes/${note.id}`;
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
		quoteAuthorizationsRepository = app.get<QuoteAuthorizationsRepository>(DI.quoteAuthorizationsRepository);
		idService = app.get<IdService>(IdService);

		authorId = await createLocalUser();
		publicNote = await createNote('public', false);
		homeNote = await createNote('home', false);
		followersNote = await createNote('followers', false);
		localOnlyNote = await createNote('public', true);
		remoteActor = await createRemoteUser();
		blockedActor = await createRemoteUser();

		await blockingsRepository.insert({
			id: idService.gen(),
			blockerId: authorId,
			blockeeId: blockedActor.id,
		});
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	test('public なローカルノートへの QuoteRequest は受理される', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));

		assert.strictEqual(result, 'ok: quote request accepted');
		assert.ok(typeof result === 'string' && !result.includes('/quote_authorizations/'), '戻り値に承認 URI が含まれていない');

		const row = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		assert.match(row.token, /^[A-Za-z0-9_-]+$/);
	});

	test('home なローカルノートへの QuoteRequest も受理される', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(homeNote), instrument));

		assert.strictEqual(result, 'ok: quote request accepted');
	});

	test('同一 (note, instrument) の再送では同じトークンが返り行は増えない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));
		const first = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: publicNote.id,
			interactingObject: instrument,
		});

		await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));
		const second = await quoteAuthorizationsRepository.findOneByOrFail({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		const count = await quoteAuthorizationsRepository.countBy({
			noteId: publicNote.id,
			interactingObject: instrument,
		});

		assert.strictEqual(first.token, second.token);
		assert.strictEqual(count, 1);
	});

	test('存在しないノートは skip される', async () => {
		const result = await apInboxService.performOneActivity(
			remoteActor,
			buildQuoteRequest(`${config.url}/notes/${idService.gen()}`, `${instrumentBase}/${randomString(undefined, 8)}`),
		);
		assert.strictEqual(result, 'skip: quoted note not found');
	});

	test('フォロワー限定ノートは skip され行が残らない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(followersNote), instrument));

		assert.strictEqual(result, 'skip: quoted note is not publicly readable');
		const count = await quoteAuthorizationsRepository.countBy({
			noteId: followersNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
	});

	test('localOnly ノートは skip され行が残らない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(localOnlyNote), instrument));

		assert.strictEqual(result, 'skip: quoted note is localOnly');
		const count = await quoteAuthorizationsRepository.countBy({
			noteId: localOnlyNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
	});

	test('ノート作者にブロックされているアクターは skip され行が残らない', async () => {
		const instrument = `${instrumentBase}/${randomString(undefined, 8)}`;
		const result = await apInboxService.performOneActivity(blockedActor, buildQuoteRequest(noteUri(publicNote), instrument));

		assert.strictEqual(result, 'skip: actor is blocked by the quoted note author');
		const count = await quoteAuthorizationsRepository.countBy({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
	});

	test('instrument がアクターのホストと異る場合は skip される', async () => {
		const result = await apInboxService.performOneActivity(
			remoteActor,
			buildQuoteRequest(noteUri(publicNote), 'https://other.example.com/notes/12345678'),
		);
		assert.strictEqual(result, 'skip: instrument host mismatch');
	});

	test('instrument が長すぎる場合は skip され行が残らない', async () => {
		const instrument = `https://${remoteHost}/${'a'.repeat(4097)}`;
		const result = await apInboxService.performOneActivity(remoteActor, buildQuoteRequest(noteUri(publicNote), instrument));

		assert.strictEqual(result, 'skip: instrument uri is too long');
		const count = await quoteAuthorizationsRepository.countBy({
			noteId: publicNote.id,
			interactingObject: instrument,
		});
		assert.strictEqual(count, 0);
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
