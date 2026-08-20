/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

'use strict';

// ダークテーマならピンク、ライトテーマならブルーの --error-* を設定する
(() => {
	try {
		const PALETTE = {
			dark: {
				bg: 'rgb(28, 28, 37)',
				fg: '#dfddcc',
				subBg: 'rgb(35, 35, 47)',
				subBgHover: 'rgba(255, 255, 255, 0.1)',
				subFg: 'rgb(185, 216, 255)',
				accent: 'rgb(255, 188, 220)',
			},
			light: {
				bg: 'rgb(238, 241, 252)',
				fg: 'rgb(87, 112, 150)',
				subBg: 'rgb(255, 255, 255)',
				subBgHover: 'rgba(0, 0, 0, 0.05)',
				subFg: 'rgb(87, 112, 150)',
				accent: 'rgb(107, 165, 227)',
			},
		};

		let dark = null;

		const theme = (() => {
			try {
				return JSON.parse(localStorage.getItem('theme') || '{}');
			} catch (_) {
				return {};
			}
		})();

		if (typeof theme.bg === 'string') {
			const m = theme.bg.match(/\d+/g);
			if (m && m.length >= 3) {
				dark = (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) < 128;
			}
		}

		if (dark == null) {
			const themeId = localStorage.getItem('themeId');
			if (themeId != null) {
				if (themeId.startsWith('d-') || themeId === 'dark') dark = true;
				else if (themeId.startsWith('l-') || themeId === 'light') dark = false;
			}
		}

		if (dark == null) {
			dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		}

		const p = dark ? PALETTE.dark : PALETTE.light;
		const root = document.documentElement.style;
		root.setProperty('--error-bg', p.bg);
		root.setProperty('--error-fg', p.fg);
		root.setProperty('--error-sub-bg', p.subBg);
		root.setProperty('--error-sub-bg-hover', p.subBgHover);
		root.setProperty('--error-sub-fg', p.subFg);
		root.setProperty('--error-accent', p.accent);
	} catch (_) {
		// localStorage等が使えない環境ではCSSのフォールバック色に任せる
	}
})();

(() => {
	document.addEventListener('DOMContentLoaded', () => {
		const locale = JSON.parse(localStorage.getItem('locale') || '{}');

		const messages = Object.assign({
			title: 'Failed to initialize CherryPick',
			serverError: 'If reloading after a period of time does not resolve the problem, contact the server administrator with the following ERROR ID.',
			solution: 'The following actions may solve the problem.',
			solution1: 'Update your os and browser',
			solution2: 'Disable an adblocker',
			solution3: 'Clear the browser cache',
			solution4: '(Tor Browser) Set dom.webaudio.enabled to true',
			otherOption: 'Other options',
			otherOption1: 'Clear preferences and cache',
			otherOption2: 'Start the simple client',
			otherOption3: 'Start the repair tool',
		}, locale?._bootErrors || {});
		const reload = locale?.reload || 'Reload';

		const reloadEls = document.querySelectorAll('[data-i18n-reload]');
		for (const el of reloadEls) {
			el.textContent = reload;
		}

		const i18nEls = document.querySelectorAll('[data-i18n]');
		for (const el of i18nEls) {
			const key = el.dataset.i18n;
			if (key && messages[key]) {
				el.textContent = messages[key];
			}
		}
	});
})();
