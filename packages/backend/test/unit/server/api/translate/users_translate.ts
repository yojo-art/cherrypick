/*
 * SPDX-FileCopyrightText: syuilo and misskey-project & noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
	mockDetectLanguage,
	mockTranslateText,
	googleTranslateMockFactory,
	fsMockFactory,
	deeplSettings,
	ctav3Settings,
	libreSettings,
	defaultServerSettings,
	deeplResponse,
	libreResponse,
	ctav3SingleResponse,
	ctav3DetectResponse,
	me,
} from './_translate-shared.js';
import { DI } from '@/di-symbols.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '@/server/api/error.js';

// ESMモードのJestではjest.mockのhoistingが効かないため unstable_mockModule + 動的import を使用
jest.unstable_mockModule('@google-cloud/translate', googleTranslateMockFactory);
jest.unstable_mockModule('node:fs', fsMockFactory);

const { default: TranslateEndpoint } = await import('@/server/api/endpoints/users/translate.js');

describe('endpoints/users/translate', () => {
	let endpoint: InstanceType<typeof TranslateEndpoint>;
	let httpRequestService: jest.Mocked<HttpRequestService>;
	let getterService: jest.Mocked<GetterService>;
	let roleService: jest.Mocked<RoleService>;
	let serverSettings: any;

	const targetUser = { description: 'こんにちは、世界' };

	const buildModule = async (settingsOverride: Partial<typeof defaultServerSettings> = {}) => {
		serverSettings = { ...defaultServerSettings, ...settingsOverride };

		httpRequestService = { send: jest.fn<(...args: any[]) => Promise<any>>() } as any;
		getterService = { getUserProfiles: jest.fn<(...args: any[]) => Promise<any>>() } as any;
		roleService = { getUserPolicies: jest.fn<(...args: any[]) => Promise<any>>() } as any;

		const moduleRef: TestingModule = await Test.createTestingModule({
			providers: [
				TranslateEndpoint,
				{ provide: DI.meta, useValue: serverSettings },
				{ provide: HttpRequestService, useValue: httpRequestService },
				{ provide: GetterService, useValue: getterService },
				{ provide: RoleService, useValue: roleService },
			],
		}).compile();

		endpoint = moduleRef.get(TranslateEndpoint);
	};

	const callEndpoint = (params: any = { userId: 'u1', targetLang: 'ja' }) =>
		(endpoint as any).exec(params, me);

	beforeEach(() => jest.clearAllMocks());

	describe('権限・対象取得', () => {
		it('canUseTranslatorがfalseならUNAVAILABLE', async () => {
			await buildModule(deeplSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: false } as any);

			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});

		it('descriptionがnullならundefinedを返す', async () => {
			await buildModule(deeplSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
			getterService.getUserProfiles.mockResolvedValue({ description: null } as any);

			await expect(callEndpoint()).resolves.toBeUndefined();
		});

		it('NO_SUCH_USER的なエラーをNO_SUCH_DESCRIPTIONに変換', async () => {
			await buildModule(deeplSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
			const err: any = new Error('no such user');
			err.id = '9725d0ce-ba28-4dde-95a7-2cbb2c15de24';
			getterService.getUserProfiles.mockRejectedValue(err);

			await expect(callEndpoint()).rejects.toMatchObject({ code: 'NO_SUCH_DESCRIPTION' });
		});

		it('translatorType未設定ならNO_TRANSLATE_SERVICE', async () => {
			await buildModule({ translatorType: null });
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
			getterService.getUserProfiles.mockResolvedValue(targetUser as any);

			await expect(callEndpoint()).rejects.toMatchObject({ code: 'NO_TRANSLATE_SERVICE' });
		});
	});

	describe('DeepL', () => {
		beforeEach(async () => {
			await buildModule(deeplSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
			getterService.getUserProfiles.mockResolvedValue(targetUser as any);
		});

		it('Free版エンドポイントを叩く', async () => {
			httpRequestService.send.mockResolvedValue(deeplResponse('Hello, world') as any);

			const res = await callEndpoint({ userId: 'u1', targetLang: 'en' });

			expect(httpRequestService.send).toHaveBeenCalledWith(
				'https://api-free.deepl.com/v2/translate',
				expect.objectContaining({ method: 'POST' }),
			);
			expect(res).toMatchObject({ sourceLang: 'JA', text: 'Hello, world' });
		});

		it('Pro版フラグで有料エンドポイント', async () => {
			serverSettings.deeplIsPro = true;
			httpRequestService.send.mockResolvedValue(deeplResponse('Hello') as any);

			await callEndpoint({ userId: 'u1', targetLang: 'en' });

			expect(httpRequestService.send).toHaveBeenCalledWith(
				'https://api.deepl.com/v2/translate',
				expect.anything(),
			);
		});

		it('targetLangのリージョン部分(en-US → en)を切り落とす', async () => {
			httpRequestService.send.mockResolvedValue(deeplResponse('Hello') as any);

			await callEndpoint({ userId: 'u1', targetLang: 'en-US' });

			const [, options] = (httpRequestService.send as jest.Mock).mock.calls[0];
			expect((options as any).body).toContain('target_lang=en');
			expect((options as any).body).not.toContain('en-US');
		});

		it('authKeyが未設定ならUNAVAILABLE', async () => {
			serverSettings.deeplAuthKey = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});

	describe('Cloud Translation Advanced', () => {
		beforeEach(async () => {
			await buildModule(ctav3Settings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
			getterService.getUserProfiles.mockResolvedValue(targetUser as any);
		});

		it('glossaryなしで翻訳できる', async () => {
			mockTranslateText.mockResolvedValue(ctav3SingleResponse('Hello, world'));

			const res = await callEndpoint({ userId: 'u1', targetLang: 'en' });

			expect(mockDetectLanguage).not.toHaveBeenCalled();
			expect(res).toMatchObject({ sourceLang: 'ja', text: 'Hello, world' });
		});

		it('glossary設定時はdetectLanguageを呼ぶ', async () => {
			serverSettings.ctav3Glossary = 'my-glossary';
			mockDetectLanguage.mockResolvedValue(ctav3DetectResponse('ja'));
			mockTranslateText.mockResolvedValue(ctav3SingleResponse('...'));

			await callEndpoint({ userId: 'u1', targetLang: 'en' });

			expect(mockDetectLanguage).toHaveBeenCalled();
			// 注意: 現実装ではdetectedLanguage(=ソース言語)がtargetLanguageCodeに渡される。
			// バグの疑いあるが挙動を固定。
			const callArg = (mockTranslateText as jest.Mock).mock.calls[0][0];
			expect((callArg as any).targetLanguageCode).toBe('ja');
			expect((callArg as any).glossaryConfig).toMatchObject({
				glossary: 'projects/proj-1/locations/global/glossaries/my-glossary',
			});
			// usersは contents が「単一テキストを配列に包む」形式
			expect((callArg as any).contents).toEqual(['こんにちは、世界']);
		});

		it('model指定時はmodel pathを組み立てる', async () => {
			serverSettings.ctav3Model = 'general/nmt';
			mockTranslateText.mockResolvedValue(ctav3SingleResponse('x'));

			await callEndpoint({ userId: 'u1', targetLang: 'en' });

			const callArg = (mockTranslateText as jest.Mock).mock.calls[0][0];
			expect((callArg as any).model).toBe('projects/proj-1/locations/global/models/general/nmt');
		});

		it('必須設定欠落でUNAVAILABLE', async () => {
			serverSettings.ctav3ProjectId = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});

	describe('LibreTranslate', () => {
		beforeEach(async () => {
			await buildModule(libreSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
			getterService.getUserProfiles.mockResolvedValue(targetUser as any);
		});

		it('翻訳結果を返す', async () => {
			httpRequestService.send.mockResolvedValue(libreResponse('Hello') as any);

			const res = await callEndpoint({ userId: 'u1', targetLang: 'en' });

			expect(httpRequestService.send).toHaveBeenCalledWith(
				'https://libretranslate.example/translate',
				expect.objectContaining({ method: 'POST' }),
			);
			expect(res).toMatchObject({ sourceLang: 'ja', text: 'Hello' });
		});

		it('APIキー設定時はbodyに含める', async () => {
			serverSettings.libreTranslateApiKey = 'libre-key';
			httpRequestService.send.mockResolvedValue(libreResponse('Hello') as any);

			await callEndpoint({ userId: 'u1', targetLang: 'en' });

			const [, options] = (httpRequestService.send as jest.Mock).mock.calls[0];
			expect(JSON.parse((options as any).body)).toMatchObject({ api_key: 'libre-key' });
		});

		it('targetLangのリージョン部分を切り落とす', async () => {
			httpRequestService.send.mockResolvedValue(libreResponse('x') as any);

			await callEndpoint({ userId: 'u1', targetLang: 'zh-CN' });

			const [, options] = (httpRequestService.send as jest.Mock).mock.calls[0];
			expect(JSON.parse((options as any).body).target).toBe('zh');
		});

		it('endpointが未設定ならUNAVAILABLE', async () => {
			serverSettings.libreTranslateEndPoint = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});
});
