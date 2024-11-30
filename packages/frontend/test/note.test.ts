/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup, type RenderResult } from '@testing-library/vue';
import './init';
import type * as Misskey from 'cherrypick-js';
import { components } from '@/components/index.js';
import { directives } from '@/directives/index.js';
import MkMediaImage from '@/components/MkMediaImage.vue';

describe('MkMediaImage', () => {
	const renderMediaImage = (image: Partial<Misskey.entities.DriveFile>): RenderResult => {
		return render(MkMediaImage, {
			props: {
				image: {
					id: 'xxxxxxxx',
					createdAt: (new Date()).toJSON(),
					isSensitive: false,
					name: 'example.png',
					thumbnailUrl: null,
					url: '',
					type: 'application/octet-stream',
					size: 1,
					md5: '15eca7fba0480996e2245f5185bf39f2',
					blurhash: null,
					comment: null,
					properties: {},
					...image,
				} as Misskey.entities.DriveFile,
			},
			global: { directives, components },
		});
	};

	afterEach(() => {
		cleanup();
	});

	test('Attaching JPG should show no indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/jpeg',
		});
		const [gif, apng, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('APNG'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(!gif);
		assert.ok(!apng);
		assert.ok(!alt);
	});

	test('Attaching GIF should show a GIF indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/gif',
		});
		const [gif, apng, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('APNG'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(gif);
		assert.ok(!apng);
		assert.ok(!alt);
	});

	test('Attaching APNG should show a APNG indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/apng',
		});
		const [gif, apng, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('APNG'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(!gif);
		assert.ok(apng);
		assert.ok(!alt);
	});

	test('Attaching image with an alt message should show an ALT indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/png',
			comment: 'CherryPickのロゴです',
		});
		const [gif, apng, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('APNG'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(!gif);
		assert.ok(!apng);
		assert.ok(alt);
	});

	test('Attaching GIF image with an alt message should show a GIF and an ALT indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/gif',
			comment: 'CherryPickのロゴです',
		});
		const [gif, apng, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('APNG'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(gif);
		assert.ok(!apng);
		assert.ok(alt);
	});
});
