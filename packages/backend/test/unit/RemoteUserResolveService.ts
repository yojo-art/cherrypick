/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, beforeAll, beforeEach, test, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';

import { MockResolver } from '../misc/mock-resolver.js';
import type { IActor } from '@/core/activitypub/type.js';
import type { MiMeta, UsersRepository } from '@/models/_.js';
import type { MiRemoteUser } from '@/models/User.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { WebfingerService } from '@/core/WebfingerService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { LoggerService } from '@/core/LoggerService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { DI } from '@/di-symbols.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';

const host = 'host1.test';

type NonTransientIActor = IActor & { id: string };

function createRandomActor(): NonTransientIActor {
	const preferredUsername = secureRndstr(8);
	const actorId = `https://${host}/users/${preferredUsername.toLowerCase()}`;

	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: actorId,
		type: 'Person',
		preferredUsername,
		inbox: `${actorId}/inbox`,
		outbox: `${actorId}/outbox`,
	};
}

async function createRandomRemoteUser(
	resolver: MockResolver,
	personService: ApPersonService,
): Promise<MiRemoteUser> {
	const actor = createRandomActor();
	resolver.register(actor.id, actor);

	return await personService.createPerson(actor.id, resolver);
}

describe('RemoteUserResolveService', () => {
	let usersRepository: UsersRepository;
	let remoteUserResolveService: RemoteUserResolveService;
	let personService: ApPersonService;
	let webfingerService: WebfingerService;
	let resolver: MockResolver;

	const metaInitial = {
		cacheRemoteFiles: true,
		cacheRemoteSensitiveFiles: true,
		enableFanoutTimeline: true,
		enableFanoutTimelineDbFallback: true,
		perUserHomeTimelineCacheMax: 100,
		perLocalUserUserTimelineCacheMax: 100,
		perRemoteUserUserTimelineCacheMax: 100,
		blockedHosts: [] as string[],
		sensitiveWords: [] as string[],
		prohibitedWords: [] as string[],
	} as MiMeta;
	const meta = { ...metaInitial };

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		})
			.overrideProvider(DI.meta).useFactory({ factory: () => meta })
			.compile();

		await app.init();
		app.enableShutdownHooks();

		usersRepository = app.get<UsersRepository>(DI.usersRepository);
		remoteUserResolveService = app.get<RemoteUserResolveService>(RemoteUserResolveService);
		personService = app.get<ApPersonService>(ApPersonService);
		webfingerService = app.get<WebfingerService>(WebfingerService);
		resolver = new MockResolver(await app.resolve<LoggerService>(LoggerService));

		// Prevent ApPersonService from fetching instance, as it causes Jest import-after-test error
		const federatedInstanceService = app.get<FederatedInstanceService>(FederatedInstanceService);
		vi.spyOn(federatedInstanceService, 'fetch').mockImplementation(() => new Promise(() => { }));
	});

	beforeEach(() => {
		resolver.clear();
	});

	test('キャッシュがあり、再取得(WebFinger)に失敗した場合はキャッシュ済みのユーザーを返す', async () => {
		const cached = await createRandomRemoteUser(resolver, personService);

		// キャッシュを古くする (lastFetchedAt を 24 時間以上前にする)
		await usersRepository.update(cached.id, {
			lastFetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
		});

		// リモートサーバーが落ちている想定 (WebFinger が失敗する)
		vi.spyOn(webfingerService, 'webfinger').mockRejectedValueOnce(new Error('remote server is down'));

		const user = await remoteUserResolveService.resolveUser(cached.usernameLower, host);

		// 再取得(WebFinger)が実際に試行されたことを保証する
		expect(webfingerService.webfinger).toHaveBeenCalledTimes(1);

		assert.strictEqual(user.id, cached.id);
		assert.strictEqual(user.username, cached.username);
		assert.strictEqual(user.host, cached.host);
		assert.strictEqual(user.uri, cached.uri);
	});

	test('キャッシュがなく、解決(WebFinger)に失敗した場合はエラーを投げる', async () => {
		const usernameLower = secureRndstr(8).toLowerCase();

		// リモートサーバーが落ちている想定 (WebFinger が失敗する)
		vi.spyOn(webfingerService, 'webfinger').mockRejectedValueOnce(new Error('remote server is down'));

		await assert.rejects(
			remoteUserResolveService.resolveUser(usernameLower, host),
			/Failed to WebFinger/,
		);
	});
});
