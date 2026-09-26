/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { afterAll, beforeAll, beforeEach, describe, expect, vi, test } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { DriveFilesRepository, DriveFoldersRepository, MiMeta, UsersRepository } from '@/models/_.js';
import type { Config } from '@/config.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { genAidx } from '@/misc/id/aidx.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';

function createService(
	configOverrides: Partial<Config> = {},
	metaOverrides: Partial<MiMeta> = {},
): DriveFileEntityService {
	return new DriveFileEntityService(
		{
			url: 'https://example.com',
			mediaProxy: 'https://proxy.example.com',
			externalMediaProxyEnabled: false,
			...configOverrides,
		} as Config,
		{
			proxyRemoteFiles: false,
			...metaOverrides,
		} as MiMeta,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
	);
}

function driveFile(overrides: Partial<MiDriveFile> = {}): MiDriveFile {
	return {
		url: 'https://example.com/files/raw',
		webpublicUrl: 'https://example.com/files/public',
		uri: null,
		userHost: null,
		isLink: false,
		webpublicAccessKey: null,
		...overrides,
	} as MiDriveFile;
}

const describeBenchmark = process.env.RUN_BENCHMARKS === '1' ? describe : describe.skip;

describe('DriveFileEntityService', () => {
	let app: TestingModule;
	let service: DriveFileEntityService;
	let driveFolderEntityService: DriveFolderEntityService;
	let driveFilesRepository: DriveFilesRepository;
	let driveFoldersRepository: DriveFoldersRepository;
	let usersRepository: UsersRepository;
	let idCounter = 0;

	const userEntityServiceMock = {
		packMany: vi.fn(async (users: Array<string | { id: string }>) => {
			return users.map(u => ({
				id: typeof u === 'string' ? u : u.id,
				username: 'user',
			}));
		}),
		pack: vi.fn(async (user: string | { id: string }) => {
			return {
				id: typeof user === 'string' ? user : user.id,
				username: 'user',
			};
		}),
	};

	const nextId = () => genAidx(Date.now() + (idCounter++));

	const createUser = async () => {
		const un = secureRndstr(16);
		const id = nextId();
		await usersRepository.insert({
			id,
			username: un,
			usernameLower: un.toLowerCase(),
		});
		return usersRepository.findOneByOrFail({ id });
	};

	const createFolder = async (name: string, parentId: string | null) => {
		const id = nextId();
		await driveFoldersRepository.insert({
			id,
			name,
			userId: null,
			parentId,
		});
		return driveFoldersRepository.findOneByOrFail({ id });
	};

	const createFile = async (folderId: string | null, userId: string | null) => {
		const id = nextId();
		await driveFilesRepository.insert({
			id,
			userId,
			userHost: null,
			md5: secureRndstr(32),
			name: `file-${id}`,
			type: 'text/plain',
			size: 1,
			comment: null,
			blurhash: null,
			properties: {},
			storedInternal: true,
			url: `https://example.com/${id}`,
			thumbnailUrl: null,
			webpublicUrl: null,
			webpublicType: null,
			accessKey: null,
			thumbnailAccessKey: null,
			webpublicAccessKey: null,
			uri: null,
			src: null,
			folderId,
			isSensitive: false,
			maybeSensitive: false,
			maybePorn: false,
			isLink: false,
			requestHeaders: null,
			requestIp: null,
		});
		return driveFilesRepository.findOneByOrFail({ id });
	};

	beforeAll(async () => {
		const moduleBuilder = Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		});
		moduleBuilder.overrideProvider(UserEntityService).useValue(userEntityServiceMock as any);

		app = await moduleBuilder.compile();
		await app.init();
		app.enableShutdownHooks();

		service = app.get<DriveFileEntityService>(DriveFileEntityService);
		driveFolderEntityService = app.get<DriveFolderEntityService>(DriveFolderEntityService);
		driveFilesRepository = app.get<DriveFilesRepository>(DI.driveFilesRepository);
		driveFoldersRepository = app.get<DriveFoldersRepository>(DI.driveFoldersRepository);
		usersRepository = app.get<UsersRepository>(DI.usersRepository);
	});

	beforeEach(() => {
		userEntityServiceMock.packMany.mockClear();
		userEntityServiceMock.pack.mockClear();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('pack', () => {
		test('detail: false', async () => {
			const user = await createUser();
			const folder = await createFolder('pack-root', null);
			const file = await createFile(folder.id, user.id);

			const packed = await service.pack(file, { detail: false, self: true }) as any;
			expect(packed.id).toBe(file.id);
			expect(packed.folder).toBeNull();
			expect(packed.user).toBeNull();
			expect(packed.userId).toBeNull();
		});

		test('detail: true', async () => {
			const folder = await createFolder('pack-parent', null);
			const child = await createFolder('pack-child', folder.id);
			const file = await createFile(child.id, null);

			const packed = await service.pack(file, { detail: true, self: true }) as any;
			expect(packed.folder?.id).toBe(child.id);
			expect(packed.folder?.parent?.id).toBe(folder.id);
		});
	});

	describe('packNullable', () => {
		test('returns null for missing', async () => {
			const packed = await service.packNullable('non-existent' as any, { detail: false });
			expect(packed).toBeNull();
		});

		test('uses packedUser hint when withUser', async () => {
			const user = await createUser();
			const file = await createFile(null, user.id);

			const packed = await service.packNullable(file, { withUser: true, self: true }, {
				packedUser: { id: user.id, username: 'hint' } as any,
			});
			expect(packed?.user?.id).toBe(user.id);
			expect(packed?.user?.username).toBe('hint');
		});
	});

	describe('packMany', () => {
		test('withUser: true uses deduped packMany', async () => {
			const user = await createUser();
			const fileA = await createFile(null, user.id);
			const fileB = await createFile(null, user.id);

			const packed = await service.packMany([fileA, fileB], { withUser: true, self: true });
			expect(packed.length).toBe(2);
			expect(userEntityServiceMock.packMany).toHaveBeenCalledTimes(1);
			expect(userEntityServiceMock.packMany.mock.calls[0]?.[0]?.length).toBe(1);
			expect(packed[0]?.user?.id).toBe(user.id);
		});

		test('detail: true packs folder', async () => {
			const folder = await createFolder('packmany-root', null);
			const file = await createFile(folder.id, null);

			const packed = await service.packMany([file], { detail: true, self: true });
			expect(packed[0]?.folder?.id).toBe(folder.id);
			expect(packed[0]?.folder?.parent).toBeUndefined();
		});

		test('detail: true uses DriveFolderEntityService pack', async () => {
			const folder = await createFolder('packmany-folder', null);
			const file = await createFile(folder.id, null);
			const packSpy = vi.spyOn(driveFolderEntityService, 'pack');

			await service.packMany([file], { detail: true, self: true });
			expect(packSpy).toHaveBeenCalled();
			packSpy.mockRestore();
		});
	});

	describeBenchmark('benchmark', () => {
		test('packMany', async () => {
			const user = await createUser();
			const folders = [];
			for (let i = 0; i < 100; i++) {
				folders.push(await createFolder(`bench-${i}`, null));
			}
			const files = [];
			for (const folder of folders) {
				for (let j = 0; j < 20; j++) {
					files.push(await createFile(folder.id, user.id));
				}
			}

			const start = Date.now();
			await service.packMany(files, { detail: true, withUser: true, self: true });
			const elapsed = Date.now() - start;

			console.log(`DriveFileEntityService.packMany benchmark: ${elapsed}ms`);
		});
	});
});

describe('DriveFileEntityService.getPublicUrl', () => {
	describe('getPublicUrl', () => {
		describe('allowProxiedUrl: false（デフォルト）', () => {
			const service = createService({
				externalMediaProxyEnabled: true,
				remoteProxy: 'https://remote-proxy.example.com',
			});

			test('webpublicUrlがある場合はそれを返す', () => {
				const file = driveFile();
				assert.strictEqual(
					service.getPublicUrl({ file }),
					'https://example.com/files/public',
				);
			});

			test('webpublicUrlがnullの場合はurlを返す', () => {
				const file = driveFile({ webpublicUrl: null });
				assert.strictEqual(
					service.getPublicUrl({ file }),
					'https://example.com/files/raw',
				);
			});

			test('プロキシが有効でもリモートファイルはプロキシしない', () => {
				const file = driveFile({
					uri: 'https://remote.example/media/a.png',
					userHost: 'remote.example',
					webpublicAccessKey: 'accesskey1',
				});
				assert.strictEqual(
					service.getPublicUrl({ file }),
					'https://example.com/files/public',
				);
			});
		});

		describe('allowProxiedUrl: true、mode未指定（リグレッション: avatarにデフォルトしない）', () => {
			test('ローカルファイルはavatarモードなしでwebpublicUrlを返す', () => {
				const service = createService();
				const result = service.getPublicUrl({
					file: driveFile(),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://example.com/files/public');
				assert.ok(!result.includes('avatar'));
			});

			test('remoteでexternalMediaProxyEnabled時はavatar=1なしのimage.webpを使う', () => {
				const service = createService({
					externalMediaProxyEnabled: true,
				});
				const uri = 'https://remote.example/media/a.png';
				const result = service.getPublicUrl({
					file: driveFile({
						uri,
						userHost: 'remote.example',
						webpublicAccessKey: null,
					}),
					allowProxiedUrl: true,
				});
				assert.ok(result.startsWith('https://proxy.example.com/image.webp?'));
				assert.ok(result.includes(`url=${encodeURIComponent(uri)}`));
				assert.ok(!result.includes('avatar=1'));
				assert.ok(!result.includes('/avatar.webp'));
			});
		});

		describe("allowProxiedUrl: true、mode: 'avatar'", () => {
			test('ローカルファイルはavatar=1付きのavatar.webpでプロキシされる', () => {
				const service = createService();
				const result = service.getPublicUrl({
					file: driveFile(),
					mode: 'avatar',
					allowProxiedUrl: true,
				});
				assert.ok(result.startsWith('https://proxy.example.com/avatar.webp?'));
				assert.ok(result.includes('avatar=1'));
				assert.ok(result.includes(`url=${encodeURIComponent('https://example.com/files/public')}`));
			});

			test('remoteでremoteProxyがあってもmodeがavatarならremoteProxy分岐をスキップする', () => {
				const service = createService({
					remoteProxy: 'https://remote-proxy.example.com',
					externalMediaProxyEnabled: true,
				});
				const uri = 'https://remote.example/media/a.png';
				const result = service.getPublicUrl({
					file: driveFile({
						uri,
						userHost: 'remote.example',
						webpublicAccessKey: 'accesskey1',
					}),
					mode: 'avatar',
					allowProxiedUrl: true,
				});
				assert.ok(!result.startsWith('https://remote-proxy.example.com/'));
				assert.ok(result.startsWith('https://proxy.example.com/'));
				assert.ok(result.includes(`url=${encodeURIComponent(uri)}`));
			});
		});

		describe('allowProxiedUrl: trueでremoteProxyあり（avatar以外）', () => {
			test('絶対URLのremoteProxyはremoteProxy/keyを返す', () => {
				const service = createService({
					remoteProxy: 'https://remote-proxy.example.com',
				});
				const result = service.getPublicUrl({
					file: driveFile({
						uri: 'https://remote.example/media/a.png',
						userHost: 'remote.example',
						webpublicAccessKey: 'accesskey1',
					}),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://remote-proxy.example.com/accesskey1');
			});

			test('相対パスのremoteProxyはconfig.urlを前置する', () => {
				const service = createService({
					remoteProxy: '/remote-proxy',
				});
				const result = service.getPublicUrl({
					file: driveFile({
						uri: 'https://remote.example/media/a.png',
						userHost: 'remote.example',
						webpublicAccessKey: 'accesskey1',
					}),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://example.com/remote-proxy/accesskey1');
			});
		});

		describe('ap: trueでapFileBaseUrlあり', () => {
			test('allowProxiedUrlがtrueかつmode未指定ならオリジンを置換する', () => {
				const service = createService({
					apFileBaseUrl: 'https://ap-files.example.com',
				});
				const result = service.getPublicUrl({
					file: driveFile(),
					ap: true,
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://ap-files.example.com/files/public');
			});

			test('allowProxiedUrlがfalseでもオリジンを置換する', () => {
				const service = createService({
					apFileBaseUrl: 'https://ap-files.example.com',
				});
				const result = service.getPublicUrl({
					file: driveFile(),
					ap: true,
					allowProxiedUrl: false,
				});
				assert.strictEqual(result, 'https://ap-files.example.com/files/public');
			});

			test('apがfalseならallowProxiedUrlがfalseでもオリジンを置換しない', () => {
				const service = createService({
					apFileBaseUrl: 'https://ap-files.example.com',
				});
				const result = service.getPublicUrl({
					file: driveFile(),
					allowProxiedUrl: false,
				});
				assert.strictEqual(result, 'https://example.com/files/public');
			});
		});

		describe('allowProxiedUrl: true、未テストだった分岐', () => {
			const remoteUri = 'https://remote.example/media/a.png';

			test("remoteでexternalMediaProxyEnabledかつmode: 'avatar'ならuriをavatar.webpでプロキシする", () => {
				const service = createService({ externalMediaProxyEnabled: true });
				const result = new URL(service.getPublicUrl({
					file: driveFile({ uri: remoteUri, userHost: 'remote.example' }),
					mode: 'avatar',
					allowProxiedUrl: true,
				}));
				assert.strictEqual(`${result.origin}${result.pathname}`, 'https://proxy.example.com/avatar.webp');
				assert.strictEqual(result.searchParams.get('url'), remoteUri);
				assert.strictEqual(result.searchParams.get('avatar'), '1');
			});

			test('isLinkかつproxyRemoteFilesならローカルの/files/keyを返す', () => {
				const service = createService({}, { proxyRemoteFiles: true });
				const result = service.getPublicUrl({
					file: driveFile({ uri: remoteUri, isLink: true, webpublicAccessKey: 'accesskey1' }),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://example.com/files/accesskey1');
			});

			test("isLinkかつproxyRemoteFilesでmode: 'avatar'ならuriをavatar.webpでプロキシする", () => {
				const service = createService({}, { proxyRemoteFiles: true });
				const result = new URL(service.getPublicUrl({
					file: driveFile({ uri: remoteUri, isLink: true, webpublicAccessKey: 'accesskey1' }),
					mode: 'avatar',
					allowProxiedUrl: true,
				}));
				assert.strictEqual(`${result.origin}${result.pathname}`, 'https://proxy.example.com/avatar.webp');
				assert.strictEqual(result.searchParams.get('url'), remoteUri);
			});

			test('webpublicAccessKeyに/を含む古いキーはremoteProxy・ローカルプロキシを使わない', () => {
				const service = createService({ remoteProxy: 'https://remote-proxy.example.com' }, { proxyRemoteFiles: true });
				const result = service.getPublicUrl({
					file: driveFile({ uri: remoteUri, userHost: 'remote.example', isLink: true, webpublicAccessKey: 'old/object/key' }),
					allowProxiedUrl: true,
				});
				assert.strictEqual(result, 'https://example.com/files/public');
			});
		});
	});

	describe('getProxiedUrl', () => {
		const service = createService();
		const original = 'https://remote.example/media/a.png';

		test('通常のURLをプロキシURLにする', () => {
			const result = new URL(service.getProxiedUrl(original));
			assert.strictEqual(`${result.origin}${result.pathname}`, 'https://proxy.example.com/image.webp');
			assert.strictEqual(result.searchParams.get('url'), original);
		});

		test.each(['image', 'avatar', 'static'] as const)('既に%sのプロキシURLなら二重にプロキシしない', (kind) => {
			const proxied = `https://proxy.example.com/${kind}.webp?url=${encodeURIComponent(original)}`;
			const result = new URL(service.getProxiedUrl(proxied, 'avatar'));
			assert.strictEqual(`${result.origin}${result.pathname}`, 'https://proxy.example.com/avatar.webp');
			assert.strictEqual(result.searchParams.get('url'), original);
			assert.strictEqual(result.searchParams.get('avatar'), '1');
		});

		test('メディアプロキシ以外のurlパラメータ付きURLはそのまま包む', () => {
			const other = `https://other.example/redirect?url=${encodeURIComponent(original)}`;
			const result = new URL(service.getProxiedUrl(other));
			assert.strictEqual(result.searchParams.get('url'), other);
		});

		test('urlパラメータの無いプロキシURLはそのまま包む', () => {
			const proxied = 'https://proxy.example.com/image.webp';
			const result = new URL(service.getProxiedUrl(proxied));
			assert.strictEqual(result.searchParams.get('url'), proxied);
		});
	});
});
