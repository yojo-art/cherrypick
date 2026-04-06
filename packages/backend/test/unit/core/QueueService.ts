/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('QueueService', () => {
	let service: QueueService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<QueueService>(QueueService);
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('createDeleteDriveFilesJob', () => {
		test('does not throw', async () => {
			await expect(service.createDeleteDriveFilesJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createExportNotesJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportNotesJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createExportFollowingJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportFollowingJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});

		test('with options', async () => {
			await expect(service.createExportFollowingJob({ id: 'test-user' } as any, true, true)).resolves.not.toThrow();
		});
	});

	describe('createExportMuteJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportMuteJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createExportBlockingJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportBlockingJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createExportUserListsJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportUserListsJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createExportAntennasJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportAntennasJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createExportFavoritesJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportFavoritesJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createExportClipsJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportClipsJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createExportCustomEmojisJob', () => {
		test('does not throw', async () => {
			await expect(service.createExportCustomEmojisJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createImportFollowingJob', () => {
		test('does not throw', async () => {
			await expect(service.createImportFollowingJob({ id: 'test-user' } as any, 'file-id')).resolves.not.toThrow();
		});
	});

	describe('createImportMutingJob', () => {
		test('does not throw', async () => {
			await expect(service.createImportMutingJob({ id: 'test-user' } as any, 'file-id')).resolves.not.toThrow();
		});
	});

	describe('createImportBlockingJob', () => {
		test('does not throw', async () => {
			await expect(service.createImportBlockingJob({ id: 'test-user' } as any, 'file-id')).resolves.not.toThrow();
		});
	});

	describe('createImportUserListsJob', () => {
		test('does not throw', async () => {
			await expect(service.createImportUserListsJob({ id: 'test-user' } as any, 'file-id')).resolves.not.toThrow();
		});
	});

	describe('createImportCustomEmojisJob', () => {
		test('does not throw', async () => {
			await expect(service.createImportCustomEmojisJob({ id: 'test-user' } as any, 'file-id')).resolves.not.toThrow();
		});
	});

	describe('createDeleteAccountJob', () => {
		test('does not throw', async () => {
			await expect(service.createDeleteAccountJob({ id: 'test-user' } as any)).resolves.not.toThrow();
		});
	});

	describe('createDeleteObjectStorageFileJob', () => {
		test('does not throw', async () => {
			await expect(service.createDeleteObjectStorageFileJob('test-key')).resolves.not.toThrow();
		});
	});

	describe('createCleanRemoteFilesJob', () => {
		test('does not throw', async () => {
			await expect(service.createCleanRemoteFilesJob()).resolves.not.toThrow();
		});
	});

	describe('createFollowJob', () => {
		test('does not throw with empty array', async () => {
			await expect(service.createFollowJob([])).resolves.not.toThrow();
		});
	});

	describe('createUnfollowJob', () => {
		test('does not throw with empty array', async () => {
			await expect(service.createUnfollowJob([])).resolves.not.toThrow();
		});
	});

	describe('createBlockJob', () => {
		test('does not throw with empty array', async () => {
			await expect(service.createBlockJob([])).resolves.not.toThrow();
		});
	});

	describe('createUnblockJob', () => {
		test('does not throw with empty array', async () => {
			await expect(service.createUnblockJob([])).resolves.not.toThrow();
		});
	});

	describe('queueGetQueues', () => {
		test('returns queue stats', async () => {
			const result = await service.queueGetQueues();
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
		});
	});
});
