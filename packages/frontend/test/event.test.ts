/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup, type RenderResult } from '@testing-library/vue';
import './init';
import * as Misskey from 'misskey-js';
import { components } from '@/components/index.js';
import { directives } from '@/directives/index.js';
import MkEvent from '@/components/MkEvent.vue';

describe('MkEvent', () => {
	const renderEvent = (metadata: Record<string, unknown>): RenderResult => {
		return render(MkEvent, {
			props: {
				note: {
					id: 'xxxxxxxx',
					createdAt: (new Date()).toJSON(),
					event: {
						title: 'poc event',
						start: (new Date()).toJSON(),
						end: null,
						metadata,
					},
				} as unknown as Misskey.entities.Note,
			},
			global: { directives, components },
		});
	};

	afterEach(() => {
		cleanup();
	});

	test('metadata.url の javascript: はリンク化されない', async () => {
		const view = renderEvent({ url: 'javascript:alert(1)' });
		const container = view.container as HTMLElement;
		assert.strictEqual(container.querySelector('a[href^="javascript"]'), null);
		assert.strictEqual(container.querySelector('a'), null);
		// 値はプレーンテキストとして残る
		assert.ok(container.textContent?.includes('javascript:alert(1)'));
	});

	test('metadata.url の大文字混じり javascript: もリンク化されない', async () => {
		const view = renderEvent({ url: 'JaVaScRiPt:alert(1)' });
		const container = view.container as HTMLElement;
		assert.strictEqual(container.querySelector('a'), null);
	});

	test('offers.url の javascript: はリンク化されない', async () => {
		const view = renderEvent({ offers: { url: 'javascript:alert(1)' } });
		const container = view.container as HTMLElement;
		assert.strictEqual(container.querySelector('a'), null);
	});

	test('metadata.url の https は target/rel 付きでリンク化される', async () => {
		const view = renderEvent({ url: 'https://example.com/event' });
		const container = view.container as HTMLElement;
		const anchor = container.querySelector('a[href="https://example.com/event"]');
		assert.ok(anchor);
		assert.strictEqual(anchor?.getAttribute('target'), '_blank');
		assert.strictEqual(anchor?.getAttribute('rel'), 'noopener noreferrer');
	});
});
