/*
 * SPDX-FileCopyrightText: syuilo and misskey-project & noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { vi } from 'vitest';

// =========================================================================
// Google Translate SDKのモック関数
// テストファイル内の vi.hoisted から参照されるため、ここでは定義のみ export する。
// (vitest の vi.mock ファクトリは同一ファイル内の hoisted 変数のみ参照可能)
// =========================================================================

export const mockDetectLanguage = vi.fn<(...args: any[]) => Promise<any>>();
export const mockTranslateText = vi.fn<(...args: any[]) => Promise<any>>();

/**
 * Google Translate SDKのモック登録ファクトリ。
 * 各テストファイルの冒頭で `vi.mock('@google-cloud/translate', googleTranslateMockFactory)`
 * のように使う。
 */
export const googleTranslateMockFactory = () => {
	class MockTranslationServiceClient {
		public detectLanguage = mockDetectLanguage;
		public translateText = mockTranslateText;
	}
	return {
		TranslationServiceClient: MockTranslationServiceClient,
	};
};

/**
 * node:fsのモック登録ファクトリ。SAキー書き込みを無害化する。
 */
export const fsMockFactory = () => {
	const stub = {
		writeFileSync: vi.fn(),
		mkdtempSync: vi.fn(() => '/tmp/fake-tmp-dir'),
		rmSync: vi.fn(),
		unlinkSync: vi.fn(),
	};
	return { default: stub, ...stub };
};

// =========================================================================
// サーバー設定のデフォルト値(全プロバイダーがnull)
// =========================================================================

export const defaultServerSettings = {
	translatorType: null as string | null,
	deeplAuthKey: null as string | null,
	deeplIsPro: false,
	ctav3SaKey: null as string | null,
	ctav3ProjectId: null as string | null,
	ctav3Location: null as string | null,
	ctav3Model: null as string | null,
	ctav3Glossary: null as string | null,
	libreTranslateEndPoint: null as string | null,
	libreTranslateApiKey: null as string | null,
};

export const deeplSettings = {
	...defaultServerSettings,
	translatorType: 'deepl',
	deeplAuthKey: 'test-key',
	deeplIsPro: false,
};

export const ctav3Settings = {
	...defaultServerSettings,
	translatorType: 'ctav3',
	ctav3SaKey: '{"fake":"sa-key"}',
	ctav3ProjectId: 'proj-1',
	ctav3Location: 'global',
};

export const libreSettings = {
	...defaultServerSettings,
	translatorType: 'libretranslate',
	libreTranslateEndPoint: 'https://libretranslate.example',
};

// =========================================================================
// プロバイダーレスポンス組み立てヘルパー
// =========================================================================

/**
 * DeepL APIのレスポンスをモックする際の `httpRequestService.send` の戻り値。
 * 単一テキスト用 (users/notes 形式)。
 */
export const deeplResponse = (text: string, sourceLang = 'JA') => ({
	json: async () => ({
		translations: [{ detected_source_language: sourceLang, text }],
	}),
});

/**
 * LibreTranslate APIのレスポンスをモックする際の `httpRequestService.send` の戻り値。
 */
export const libreResponse = (translatedText: string, language = 'ja') => ({
	json: async () => ({
		translatedText,
		detectedLanguage: { confidence: 99, language },
	}),
});

/**
 * Google Cloud Translation Advancedの translateText レスポンス組み立て。
 * 単一テキスト用 (users/notes 形式)。
 */
export const ctav3SingleResponse = (translatedText: string, detectedLanguageCode = 'ja') => [{
	translations: [{ translatedText, detectedLanguageCode }],
}];

/**
 * ctav3の複数テキスト用レスポンス (polls形式)。
 */
export const ctav3MultiResponse = (translations: string[], detectedLanguageCode = 'ja') => [{
	translations: translations.map(t => ({ translatedText: t, detectedLanguageCode })),
}];

/**
 * ctav3の言語検出レスポンス組み立て。
 */
export const ctav3DetectResponse = (languageCode = 'ja') => [{
	languages: [{ languageCode }],
}];

// =========================================================================
// 汎用ユーティリティ
// =========================================================================

export const me = { id: 'user-self' } as any;
