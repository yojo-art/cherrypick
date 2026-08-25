/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { afterAll, beforeAll, beforeEach, describe, test, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import {
	DeleteObjectCommand,
	DeleteObjectCommandOutput,
	InvalidObjectState,
	NoSuchKey,
	S3Client,
	CopyObjectCommand,
	CopyObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import type { TestingModule } from '@nestjs/testing';
import { GlobalModule } from '@/GlobalModule.js';
import { DriveService } from '@/core/DriveService.js';
import { CoreModule } from '@/core/CoreModule.js';

describe('DriveService', () => {
	let app: TestingModule;
	let driveService: DriveService;
	const s3Mock = mockClient(S3Client);

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [DriveService],
		}).compile();
		app.enableShutdownHooks();
		driveService = app.get<DriveService>(DriveService);
	});

	beforeEach(async () => {
		s3Mock.reset();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('Object storage', () => {
		test('copies an object-storage file', async () => {
			s3Mock.on(CopyObjectCommand).callsFake(input => {
				expect((input.input as { CopySource: string }).CopySource).toMatch(/^bucket\/.+$/);
				return {} as CopyObjectCommandOutput;
			});

			const copied = await driveService.copy({
				file: {
					id: 'a'.repeat(24),
					accessKey: 'original/uuid.jpg',
					name: 'test.jpg',
					type: 'image/jpeg',
					size: 1024,
					storedInternal: false,
					userHost: null,
				} as any,
				folderId: null,
				userId: null,
				userHost: null,
			});

			expect(copied.accessKey).not.toBe('original/uuid.jpg');
		});

		test('delete a file', async () => {
			s3Mock.on(DeleteObjectCommand)
				.resolves({} as DeleteObjectCommandOutput);

			await driveService.deleteObjectStorageFile('peace of the world');
		});

		test('delete a file then unexpected error', async () => {
			s3Mock.on(DeleteObjectCommand)
				.rejects(new InvalidObjectState({ $metadata: {}, message: '' }));

			await expect(driveService.deleteObjectStorageFile('unexpected')).rejects.toThrow(Error);
		});

		test('delete a file with no valid key', async () => {
			// Some S3 implementations returns 404 Not Found on deleting with a non-existent key
			s3Mock.on(DeleteObjectCommand)
				.rejects(new NoSuchKey({ $metadata: {}, message: 'allowed error.' }));

			await driveService.deleteObjectStorageFile('lol no way');
		});
	});
});
