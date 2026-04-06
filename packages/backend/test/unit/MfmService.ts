/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import * as mfm from 'mfc-js';
import { Test } from '@nestjs/testing';

import { CoreModule } from '@/core/CoreModule.js';
import { MfmService } from '@/core/MfmService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('MfmService', () => {
	let mfmService: MfmService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		mfmService = app.get<MfmService>(MfmService);
	});

	describe('toHtml', () => {
		test('br', () => {
			const input = 'foo\nbar\nbaz';
			const output = '<p><span>foo<br />bar<br />baz</span></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('br alt', () => {
			const input = 'foo\r\nbar\rbaz';
			const output = '<p><span>foo<br />bar<br />baz</span></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('Do not generate unnecessary span', () => {
			const input = 'foo $[tada bar]';
			const output = '<p>foo <i>bar</i></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('escape', () => {
			const input = '```\n<p>Hello, world!</p>\n```';
			const output = '<p><pre><code>&lt;p&gt;Hello, world!&lt;/p&gt;</code></pre></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('bold', () => {
			const input = '**bold**';
			const output = '<p><b>bold</b></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('small', () => {
			const input = '<small>small</small>';
			const output = '<p><small>small</small></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('strike', () => {
			const input = '~~strike~~';
			const output = '<p><del>strike</del></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('italic', () => {
			const input = '<i>italic</i>';
			const output = '<p><i>italic</i></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('blockCode', () => {
			const input = '```\nconsole.log("hello");\n```';
			const result = mfmService.toHtml(mfm.parse(input));
			assert.ok(result?.includes('<pre><code>'));
			assert.ok(result?.includes('</code></pre>'));
		});

		test('center', () => {
			const input = '<center>center</center>';
			const output = '<p><div>center</div></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('inlineCode', () => {
			const input = '`code`';
			const output = '<p><code>code</code></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('mathInline', () => {
			const input = '\\(x^2\\)';
			const output = '<p><code>x^2</code></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('mathBlock', () => {
			const input = '\\[x^2\\]';
			const output = '<p><code>x^2</code></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('link', () => {
			const input = '[example](https://example.com)';
			const output = '<p><a href="https://example.com">example</a></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('quote', () => {
			const input = '> quote';
			const output = '<p><blockquote>quote</blockquote></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('url', () => {
			const input = 'https://example.com';
			const output = '<p><a href="https://example.com">https://example.com</a></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('search', () => {
			const input = 'test [search]';
			const output = '<p><a href="https://www.google.com/search?q=test">test [search]</a></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('hashtag', () => {
			const input = '#test';
			const output = '<p><a href="http://cherrypick.local/tags/test" rel="tag">#test</a></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('emojiCode', () => {
			const input = ':emoji:';
			const output = '<p>\u200B:emoji:\u200B</p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('unicodeEmoji', () => {
			const input = '\u{1F600}';
			const output = '<p>\u{1F600}</p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('mention', () => {
			const input = '@user';
			const result = mfmService.toHtml(mfm.parse(input));
			assert.ok(result?.includes('@user'));
		});

		test('plain', () => {
			const input = '<plain>plain</plain>';
			const output = '<p><span>plain</span></p>';
			assert.equal(mfmService.toHtml(mfm.parse(input)), output);
		});

		test('null input returns null', () => {
			assert.equal(mfmService.toHtml(null), null);
		});

		test('fn ruby', () => {
			const input = '$[ruby CherryPick チェリーピック]';
			const result = mfmService.toHtml(mfm.parse(input));
			assert.ok(result?.includes('<ruby>'));
			assert.ok(result?.includes('<rt>'));
		});

		test('fn unixtime', () => {
			const input = '$[unixtime 1700000000]';
			const result = mfmService.toHtml(mfm.parse(input));
			assert.ok(result?.includes('<time'));
		});
	});

	describe('fromHtml', () => {
		test('p', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a</p><p>b</p>'), 'a\n\nb');
		});

		test('block element', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<div>a</div><div>b</div>'), 'a\nb');
		});

		test('inline element', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<ul><li>a</li><li>b</li></ul>'), 'a\nb');
		});

		test('block code', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<pre><code>a\nb</code></pre>'), '```\na\nb\n```');
		});

		test('inline code', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<code>a</code>'), '`a`');
		});

		test('quote', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<blockquote>a\nb</blockquote>'), '> a\n> b');
		});

		test('br', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>abc<br><br/>d</p>'), 'abc\n\nd');
		});

		test('link with different text', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a href="https://example.com/b">c</a> d</p>'), 'a [c](https://example.com/b) d');
		});

		test('link with different text, but not encoded', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a href="https://example.com/ä">c</a> d</p>'), 'a [c](<https://example.com/ä>) d');
		});

		test('link with same text', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a href="https://example.com/b">https://example.com/b</a> d</p>'), 'a https://example.com/b d');
		});

		test('link with same text, but not encoded', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a href="https://example.com/ä">https://example.com/ä</a> d</p>'), 'a <https://example.com/ä> d');
		});

		test('link with no url', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a href="b">c</a> d</p>'), 'a [c](b) d');
		});

		test('link without href', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a>c</a> d</p>'), 'a c d');
		});

		test('link without text', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a href="https://example.com/b"></a> d</p>'), 'a https://example.com/b d');
		});

		test('link without both', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a></a> d</p>'), 'a  d');
		});

		test('ruby', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <ruby>CherryPick<rp>(</rp><rt>チェリーピック</rt><rp>)</rp></ruby> b</p>'), 'a $[ruby CherryPick チェリーピック] b');
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <ruby>CherryPick<rp>(</rp><rt>チェリーピック</rt><rp>)</rp>CherryPick<rp>(</rp><rt>チェリーピック</rt><rp>)</rp></ruby> b</p>'), 'a $[ruby CherryPick チェリーピック]$[ruby CherryPick チェリーピック] b');
		});

		test('ruby with spaces', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <ruby>Cherry Pick<rp>(</rp><rt>チェリーピック</rt><rp>)</rp> b</ruby> c</p>'), 'a Cherry Pick(チェリーピック) b c');
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <ruby>CherryPick<rp>(</rp><rt>チェリー ピック</rt><rp>)</rp> b</ruby> c</p>'), 'a CherryPick(チェリー ピック) b c');
			assert.deepStrictEqual(
				mfmService.fromHtml('<p>a <ruby>CherryPick<rp>(</rp><rt>チェリーピック</rt><rp>)</rp>CherryPick<rp>(</rp><rt>ミス キー</rt><rp>)</rp>CherryPick<rp>(</rp><rt>チェリーピック</rt><rp>)</rp></ruby> b</p>'),
				'a CherryPick(チェリーピック)CherryPick(ミス キー)CherryPick(チェリーピック) b',
			);
		});

		test('ruby with other inline tags', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <ruby><strong>CherryPick</strong><rp>(</rp><rt>チェリーピック</rt><rp>)</rp> b</ruby> c</p>'), 'a **CherryPick**(チェリーピック) b c');
		});

		test('mention', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a href="https://example.com/@user" class="u-url mention">@user</a> d</p>'), 'a @user@example.com d');
		});

		test('hashtag', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p>a <a href="https://example.com/tags/a">#a</a> d</p>', ['#a']), 'a #a d');
		});

		test('h1', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<h1>heading</h1>'), '【heading】');
		});

		test('bold (b tag)', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p><b>bold</b></p>'), '**bold**');
		});

		test('bold (strong tag)', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p><strong>bold</strong></p>'), '**bold**');
		});

		test('small', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p><small>small</small></p>'), '<small>small</small>');
		});

		test('strikethrough (s tag)', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p><s>strike</s></p>'), '~~strike~~');
		});

		test('strikethrough (del tag)', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p><del>strike</del></p>'), '~~strike~~');
		});

		test('italic (i tag)', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p><i>italic</i></p>'), '<i>italic</i>');
		});

		test('italic (em tag)', () => {
			assert.deepStrictEqual(mfmService.fromHtml('<p><em>italic</em></p>'), '<i>italic</i>');
		});
	});
});
