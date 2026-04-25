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
	ctav3MultiResponse,
	ctav3DetectResponse,
	me,
} from './_translate-shared.js';
import { DI } from '@/di-symbols.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '@/server/api/error.js';

jest.unstable_mockModule('@google-cloud/translate', googleTranslateMockFactory);
jest.unstable_mockModule('node:fs', fsMockFactory);

const { default: TranslateEndpoint } = await import('@/server/api/endpoints/notes/polls/translate.js');

describe('endpoints/notes/polls/translate', () => {
	let endpoint: InstanceType<typeof TranslateEndpoint>;
	let httpRequestService: jest.Mocked<HttpRequestService>;
	let pollsRepository: any;
	let roleService: jest.Mocked<RoleService>;
	let serverSettings: any;

	const targetPoll = { choices: ['選択肢A', '選択肢B', '選択肢C'] };

	const buildModule = async (settingsOverride: Partial<typeof defaultServerSettings> = {}) => {
		serverSettings = { ...defaultServerSettings, ...settingsOverride };

		httpRequestService = { send: jest.fn<(...args: any[]) => Promise<any>>() } as any;
		pollsRepository = { findOneByOrFail: jest.fn() };
		roleService = { getUserPolicies: jest.fn<(...args: any[]) => Promise<any>>() } as any;

		const moduleRef: TestingModule = await Test.createTestingModule({
			providers: [
				TranslateEndpoint,
				{ provide: DI.meta, useValue: serverSettings },
				{ provide: DI.pollsRepository, useValue: pollsRepository },
				{ provide: HttpRequestService, useValue: httpRequestService },
				{ provide: RoleService, useValue: roleService },
			],
		}).compile();

		endpoint = moduleRef.get(TranslateEndpoint);
	};

	const callEndpoint = (params: any = { noteId: 'n1', targetLang: 'ja' }) =>
		(endpoint as any).exec(params, me);

	const setHappyPath = (poll: any = targetPoll) => {
		roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
		pollsRepository.findOneByOrFail.mockResolvedValue(poll);
	};

	beforeEach(() => jest.clearAllMocks());

	describe('権限・対象取得', () => {
		it('canUseTranslatorがfalseならUNAVAILABLE', async () => {
			await buildModule(deeplSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: false } as any);

			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});

		it('poll.choicesがnullならundefinedを返す', async () => {
			await buildModule(deeplSettings);
			setHappyPath({ choices: null });

			await expect(callEndpoint()).resolves.toBeUndefined();
		});

		// 注意: 他のtranslateエンドポイントと違い、polls/translate は default 時に
		// ApiError ではなく素の Error('Unsupported translator type') を投げる仕様。
		// 挙動を固定しつつコードレビュー時に修正候補にすべき。
		it('translatorType未設定なら素のErrorを投げる(他エンドポイントと挙動が違う)', async () => {
			await buildModule({ translatorType: null });
			setHappyPath();

			await expect(callEndpoint()).rejects.toThrow('Unsupported translator type');
		});
	});

	describe('DeepL (配列ループ呼び出し)', () => {
		beforeEach(async () => {
			await buildModule(deeplSettings);
			setHappyPath();
		});

		it('choicesの数だけhttpRequestService.sendを呼ぶ', async () => {
			(httpRequestService.send as jest.Mock)
				.mockResolvedValueOnce(deeplResponse('A-en') as never)
				.mockResolvedValueOnce(deeplResponse('B-en') as never)
				.mockResolvedValueOnce(deeplResponse('C-en') as never);

			const res = await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			expect(httpRequestService.send).toHaveBeenCalledTimes(3);
			expect(res).toMatchObject({
				sourceLang: 'JA',
				text: ['A-en', 'B-en', 'C-en'],
			});
		});

		it('Pro版フラグで有料エンドポイント', async () => {
			serverSettings.deeplIsPro = true;
			(httpRequestService.send as jest.Mock).mockResolvedValue(deeplResponse('x') as never);

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			expect(httpRequestService.send).toHaveBeenCalledWith(
				'https://api.deepl.com/v2/translate',
				expect.anything(),
			);
		});

		it('authKey未設定でUNAVAILABLE', async () => {
			serverSettings.deeplAuthKey = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});

	describe('Cloud Translation Advanced (配列を一括翻訳)', () => {
		beforeEach(async () => {
			await buildModule(ctav3Settings);
			setHappyPath();
		});

		it('contents には choices 配列がそのまま渡される(usersやnotesと違う)', async () => {
			mockTranslateText.mockResolvedValue(ctav3MultiResponse(['A-en', 'B-en', 'C-en']));

			const res = await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const callArg = (mockTranslateText as jest.Mock).mock.calls[0][0];
			expect((callArg as any).contents).toEqual(['選択肢A', '選択肢B', '選択肢C']);
			expect(res).toMatchObject({
				sourceLang: 'ja',
				text: ['A-en', 'B-en', 'C-en'],
			});
		});

		it('glossary設定時は detect 用に choices.join("\\n") を渡す', async () => {
			serverSettings.ctav3Glossary = 'my-glossary';
			mockDetectLanguage.mockResolvedValue(ctav3DetectResponse('ja'));
			mockTranslateText.mockResolvedValue(ctav3MultiResponse(['x', 'y', 'z']));

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const detectArg = (mockDetectLanguage as jest.Mock).mock.calls[0][0];
			expect((detectArg as any).content).toBe('選択肢A\n選択肢B\n選択肢C');
		});

		it('model指定時はmodel pathを組み立てる', async () => {
			serverSettings.ctav3Model = 'general/nmt';
			mockTranslateText.mockResolvedValue(ctav3MultiResponse(['x', 'y', 'z']));

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const callArg = (mockTranslateText as jest.Mock).mock.calls[0][0];
			expect((callArg as any).model).toBe('projects/proj-1/locations/global/models/general/nmt');
		});

		it('必須設定欠落でUNAVAILABLE', async () => {
			serverSettings.ctav3Location = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});

	describe('LibreTranslate (配列ループ呼び出し)', () => {
		beforeEach(async () => {
			await buildModule(libreSettings);
			setHappyPath();
		});

		it('choicesの数だけhttpRequestService.sendを呼ぶ', async () => {
			(httpRequestService.send as jest.Mock)
				.mockResolvedValueOnce(libreResponse('A-en') as never)
				.mockResolvedValueOnce(libreResponse('B-en') as never)
				.mockResolvedValueOnce(libreResponse('C-en') as never);

			const res = await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			expect(httpRequestService.send).toHaveBeenCalledTimes(3);
			expect(res).toMatchObject({
				sourceLang: 'ja',
				text: ['A-en', 'B-en', 'C-en'],
			});
		});

		it('APIキー設定時は全リクエストのbodyに含める', async () => {
			serverSettings.libreTranslateApiKey = 'libre-key';
			(httpRequestService.send as jest.Mock).mockResolvedValue(libreResponse('x') as never);

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const calls = (httpRequestService.send as jest.Mock).mock.calls;
			for (const [, options] of calls) {
				expect(JSON.parse((options as any).body)).toMatchObject({ api_key: 'libre-key' });
			}
		});

		it('endpoint未設定でUNAVAILABLE', async () => {
			serverSettings.libreTranslateEndPoint = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});
});
