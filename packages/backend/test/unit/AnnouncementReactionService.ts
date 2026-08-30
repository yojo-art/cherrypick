/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { describe, expect, beforeEach, afterEach, beforeAll, afterAll, test, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { DeepMockProxy } from 'vitest-mock-extended';
import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { GlobalModule } from '@/GlobalModule.js';
import { AnnouncementReactionService, AnnouncementReactionErrorIds } from '@/core/AnnouncementReactionService.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { DEFAULT_POLICIES, RoleService } from '@/core/RoleService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import type { AnnouncementReactionsRepository, AnnouncementsRepository, UsersRepository, MiUser, MiAnnouncement, MiEmoji } from '@/models/_.js';
import { genAidx } from '@/misc/id/aidx.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';

function genId() {
	return genAidx(Date.now());
}

describe('AnnouncementReactionService', () => {
	let app: TestingModule;
	let service: AnnouncementReactionService;
	let announcementReactionsRepository: AnnouncementReactionsRepository;
	let announcementsRepository: AnnouncementsRepository;
	let usersRepository: UsersRepository;
	let customEmojiService: DeepMockProxy<CustomEmojiService>;
	let roleService: DeepMockProxy<RoleService>;
	let globalEventService: DeepMockProxy<GlobalEventService>;

	beforeAll(async () => {
		customEmojiService = mockDeep<CustomEmojiService>();
		roleService = mockDeep<RoleService>();
		globalEventService = mockDeep<GlobalEventService>();

		app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		})
			.overrideProvider(CustomEmojiService)
			.useValue(customEmojiService as unknown as CustomEmojiService)
			.overrideProvider(RoleService)
			.useValue(roleService as unknown as RoleService)
			.overrideProvider(GlobalEventService)
			.useValue(globalEventService as unknown as GlobalEventService)
			.compile();
		app.enableShutdownHooks();
		await app.init();

		service = app.get<AnnouncementReactionService>(AnnouncementReactionService);
		announcementReactionsRepository = app.get<AnnouncementReactionsRepository>(DI.announcementReactionsRepository);
		announcementsRepository = app.get<AnnouncementsRepository>(DI.announcementsRepository);
		usersRepository = app.get<UsersRepository>(DI.usersRepository);
	}, 60000);

	afterAll(async () => {
		await app.close();
	}, 60000);

	function createUser(data: Partial<MiUser> = {}) {
		const un = secureRndstr(16);
		return usersRepository.insert({
			id: genId(),
			username: un,
			usernameLower: un.toLowerCase(),
			...data,
		}).then(x => usersRepository.findOneByOrFail(x.identifiers[0]));
	}

	function createAnnouncement(data: Partial<MiAnnouncement> = {}) {
		return announcementsRepository.insert({
			id: genId(),
			title: 'Title',
			text: 'Text',
			...data,
		}).then(x => announcementsRepository.findOneByOrFail(x.identifiers[0]));
	}

	function mockEmoji(name: string, roleIdsThatCanBeUsedThisEmojiAsReaction: string[] = []): MiEmoji {
		return {
			name,
			roleIdsThatCanBeUsedThisEmojiAsReaction,
		} as MiEmoji;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map());
		roleService.getUserRoles.mockResolvedValue([]);
		roleService.getUserPolicies.mockResolvedValue(DEFAULT_POLICIES);
	});

	afterEach(async () => {
		await Promise.all([
			announcementReactionsRepository.createQueryBuilder().delete().execute(),
			announcementsRepository.createQueryBuilder().delete().execute(),
			usersRepository.createQueryBuilder().delete().execute(),
		]);
	}, 30000);

	describe('create', () => {
		test('Unicode リアクションは正規化されて保存される', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();

			await service.create(user, announcement, 'like');

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows).toHaveLength(1);
			expect(rows[0].reaction).toBe('👍');
		});

		test('存在しないカスタム絵文字は FALLBACK に置換される', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();

			await service.create(user, announcement, ':does_not_exist:');

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows[0].reaction).toBe('❤');
		});

		test('ロール制限のある絵文字は権限が無いと FALLBACK に置換される', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();
			customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['restricted', mockEmoji('restricted', ['role1'])]]));
			roleService.getUserRoles.mockResolvedValue([]);

			await service.create(user, announcement, ':restricted:');

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows[0].reaction).toBe('❤');
		});

		test('ロール制限のある絵文字は権限があればそのまま保存される', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();
			customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['restricted', mockEmoji('restricted', ['role1'])]]));
			roleService.getUserRoles.mockResolvedValue([{ id: 'role1' }] as any);

			await service.create(user, announcement, ':restricted:');

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows[0].reaction).toBe(':restricted:');
		});

		test('リモートユーザーはカスタム絵文字を使えない', async () => {
			const user = await createUser({ host: 'remote.example' });
			const announcement = await createAnnouncement();
			customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['local', mockEmoji('local')]]));

			await service.create(user, announcement, ':local:');

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows[0].reaction).toBe('❤');
		});

		test('同一 (user, announcement, reaction) は重複エラーになる', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();

			await service.create(user, announcement, 'like');

			let thrown: any;
			try {
				await service.create(user, announcement, 'like');
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toBeDefined();
			expect(thrown.id).toBe(AnnouncementReactionErrorIds.alreadyReacted);
		});

		test('上限に達したユーザーは新規リアクションを付けられない', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();
			roleService.getUserPolicies.mockResolvedValue({ ...DEFAULT_POLICIES, reactionLimit: 2 });

			await service.create(user, announcement, 'like');
			await service.create(user, announcement, 'pudding');

			let thrown: any;
			try {
				await service.create(user, announcement, 'angry');
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toBeDefined();
			expect(thrown.id).toBe(AnnouncementReactionErrorIds.tooManyReactions);

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows).toHaveLength(2);
		});

		test('reactionLimit が 0 のユーザーはリアクションできない', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();
			roleService.getUserPolicies.mockResolvedValue({ ...DEFAULT_POLICIES, reactionLimit: 0 });

			let thrown: any;
			try {
				await service.create(user, announcement, 'like');
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toBeDefined();
			expect(thrown.id).toBe(AnnouncementReactionErrorIds.tooManyReactions);

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows).toHaveLength(0);
		});

		test('他ユーザーのリアクションは自分の上限にカウントされない', async () => {
			const userA = await createUser();
			const userB = await createUser();
			const announcement = await createAnnouncement();
			roleService.getUserPolicies.mockResolvedValue({ ...DEFAULT_POLICIES, reactionLimit: 1 });

			await service.create(userA, announcement, 'like');
			await service.create(userB, announcement, 'pudding');

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows).toHaveLength(2);
		});
	});

	describe('delete', () => {
		test('リアクションを削除できる', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();
			customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['custom', mockEmoji('custom')]]));

			await service.create(user, announcement, ':custom:');
			await service.delete(user, announcement, ':custom@.:');

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows).toHaveLength(0);
		});

		test('絵文字が削除・権限を失効しても自分のリアクションを削除できる', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();
			customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['vanish', mockEmoji('vanish')]]));

			await service.create(user, announcement, ':vanish:');

			// 作成後に絵文字情報を消す
			customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map());

			await expect(service.delete(user, announcement, ':vanish@.:')).resolves.toBeUndefined();
			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows).toHaveLength(0);
		});

		test('付けていないリアクションを削除するとエラー', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();

			let thrown: any;
			try {
				await service.delete(user, announcement, ':none:');
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toBeDefined();
			expect(thrown.id).toBe(AnnouncementReactionErrorIds.notReacted);
		});

		test('削除後に同じリアクションを再度付けられる', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();

			await service.create(user, announcement, 'like');
			await service.delete(user, announcement, 'like');
			await service.create(user, announcement, 'like');

			const rows = await announcementReactionsRepository.findBy({ announcementId: announcement.id });
			expect(rows).toHaveLength(1);
		});
	});

	describe('getCounts / getMyReactions', () => {
		test('カスタム絵文字は decodeReaction 済みのキーを返す', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();
			customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['local', mockEmoji('local')]]));

			await service.create(user, announcement, ':local:');

			const counts = await service.getCounts([announcement.id]);
			expect(counts.get(announcement.id)).toEqual({ ':local@.:': 1 });

			const mine = await service.getMyReactions([announcement.id], user.id);
			expect(mine.get(announcement.id)).toEqual([':local@.:']);
		});

		test('複数ユーザー・複数種類のリアクションを集計できる', async () => {
			const userA = await createUser();
			const userB = await createUser();
			const announcement = await createAnnouncement();

			await service.create(userA, announcement, 'like');
			await service.create(userA, announcement, 'pudding');
			await service.create(userB, announcement, 'like');

			const counts = await service.getCounts([announcement.id]);
			expect(counts.get(announcement.id)).toEqual({ '👍': 2, '🍮': 1 });

			const mineA = await service.getMyReactions([announcement.id], userA.id);
			expect([...(mineA.get(announcement.id) ?? [])].sort()).toEqual(['🍮', '👍']);

			const mineB = await service.getMyReactions([announcement.id], userB.id);
			expect(mineB.get(announcement.id)).toEqual(['👍']);
		});
	});

	describe('stream events', () => {
		test('グローバルお知らせへのリアクションは broadcast する', async () => {
			const user = await createUser();
			const announcement = await createAnnouncement();

			await service.create(user, announcement, 'like');

			expect(globalEventService.publishBroadcastStream).toHaveBeenCalledWith('announcementReacted', expect.objectContaining({
				announcementId: announcement.id,
				reaction: '👍',
				userId: user.id,
			}));
			expect(globalEventService.publishMainStream).not.toHaveBeenCalled();

			await service.delete(user, announcement, 'like');

			expect(globalEventService.publishBroadcastStream).toHaveBeenCalledWith('announcementUnreacted', expect.objectContaining({
				announcementId: announcement.id,
				reaction: '👍',
				userId: user.id,
			}));
		});

		test('個人宛てお知らせへのリアクションは宛先ユーザーの mainStream に限定する', async () => {
			const target = await createUser();
			const reactor = await createUser();
			const announcement = await createAnnouncement({ userId: target.id });

			await service.create(reactor, announcement, 'like');

			expect(globalEventService.publishMainStream).toHaveBeenCalledWith(target.id, 'announcementReacted', expect.objectContaining({
				announcementId: announcement.id,
				reaction: '👍',
				userId: reactor.id,
			}));
			expect(globalEventService.publishBroadcastStream).not.toHaveBeenCalled();

			await service.delete(reactor, announcement, 'like');

			expect(globalEventService.publishMainStream).toHaveBeenCalledWith(target.id, 'announcementUnreacted', expect.objectContaining({
				announcementId: announcement.id,
				reaction: '👍',
				userId: reactor.id,
			}));
		});
	});
});
