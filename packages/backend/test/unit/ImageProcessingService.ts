/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { ImageProcessingService } from '@/core/ImageProcessingService.js';
import { GlobalModule } from '@/GlobalModule.js';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

describe('ImageProcessingService', () => {
	let imageProcessingService: ImageProcessingService;
	const testImagePath = path.join(_dirname, '../resources/192.png');

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		imageProcessingService = app.get<ImageProcessingService>(ImageProcessingService);
	});

	describe('convertToWebp', () => {
		test('converts PNG to WebP', async () => {
			if (!fs.existsSync(testImagePath)) return; // skip if test resource missing
			const result = await imageProcessingService.convertToWebp(testImagePath, 100, 100);
			expect(result.ext).toBe('webp');
			expect(result.type).toBe('image/webp');
			expect(result.data).toBeInstanceOf(Buffer);
			expect(result.data.length).toBeGreaterThan(0);
		});
	});

	describe('convertToWebpStream', () => {
		test('returns IImageSharp with webp type', () => {
			if (!fs.existsSync(testImagePath)) return;
			const result = imageProcessingService.convertToWebpStream(testImagePath, 100, 100);
			expect(result.ext).toBe('webp');
			expect(result.type).toBe('image/webp');
			expect(result.data).toBeDefined();
		});
	});

	describe('convertToAvif', () => {
		test('converts PNG to AVIF', async () => {
			if (!fs.existsSync(testImagePath)) return;
			const result = await imageProcessingService.convertToAvif(testImagePath, 100, 100);
			expect(result.ext).toBe('avif');
			expect(result.type).toBe('image/avif');
			expect(result.data).toBeInstanceOf(Buffer);
		});
	});

	describe('convertToAvifStream', () => {
		test('returns IImageSharp with avif type', () => {
			if (!fs.existsSync(testImagePath)) return;
			const result = imageProcessingService.convertToAvifStream(testImagePath, 100, 100);
			expect(result.ext).toBe('avif');
			expect(result.type).toBe('image/avif');
		});
	});

	describe('convertToPng', () => {
		test('converts to PNG', async () => {
			if (!fs.existsSync(testImagePath)) return;
			const result = await imageProcessingService.convertToPng(testImagePath, 100, 100);
			expect(result.ext).toBe('png');
			expect(result.type).toBe('image/png');
			expect(result.data).toBeInstanceOf(Buffer);
		});
	});
});
