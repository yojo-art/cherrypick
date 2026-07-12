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
} from '../../../../helpers/translate-shared.js';
import { DI } from '@/di-symbols.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { ApiError } from '@/server/api/error.js';

jest.unstable_mockModule('@google-cloud/translate', googleTranslateMockFactory);
jest.unstable_mockModule('node:fs', fsMockFactory);

const { default: TranslateEndpoint } = await import('@/server/api/endpoints/notes/translate.js');

describe('endpoints/notes/translate', () => {
	let endpoint: InstanceType<typeof TranslateEndpoint>;
	let httpRequestService: jest.Mocked<HttpRequestService>;
	let getterService: jest.Mocked<GetterService>;
	let roleService: jest.Mocked<RoleService>;
	let noteEntityService: jest.Mocked<NoteEntityService>;
	let serverSettings: any;

	//const targetNote = { text: 'こんにちは、世界', cw: null };
	const targetNote = { text: 'こんにちは、世界', cw: null } as any;

	const buildModule = async (settingsOverride: Partial<typeof defaultServerSettings> = {}) => {
		serverSettings = { ...defaultServerSettings, ...settingsOverride };

		httpRequestService = { send: jest.fn<(...args: any[]) => Promise<any>>() } as any;
		getterService = { getNote: jest.fn<(...args: any[]) => Promise<any>>() } as any;
		roleService = { getUserPolicies: jest.fn<(...args: any[]) => Promise<any>>() } as any;
		noteEntityService = { isVisibleForMe: jest.fn<(...args: any[]) => Promise<boolean>>() } as any;

		const moduleRef: TestingModule = await Test.createTestingModule({
			providers: [
				TranslateEndpoint,
				{ provide: DI.meta, useValue: serverSettings },
				{ provide: HttpRequestService, useValue: httpRequestService },
				{ provide: GetterService, useValue: getterService },
				{ provide: RoleService, useValue: roleService },
				{ provide: NoteEntityService, useValue: noteEntityService },
			],
		}).compile();

		endpoint = moduleRef.get(TranslateEndpoint);
	};

	const callEndpoint = (params: any = { noteId: 'n1', targetLang: 'ja' }) =>
		(endpoint as any).exec(params, me);

	const setHappyPath = (note: any = targetNote) => {
		roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
		getterService.getNote.mockResolvedValue(note);
		noteEntityService.isVisibleForMe.mockResolvedValue(true);
	};

	beforeEach(() => jest.clearAllMocks());

	describe('権限・対象取得・可視性', () => {
		it('canUseTranslatorがfalseならUNAVAILABLE', async () => {
			await buildModule(deeplSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: false } as any);

			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});

		it('NO_SUCH_NOTE的なエラーをNO_SUCH_NOTEに変換', async () => {
			await buildModule(deeplSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
			const err: any = new Error('no such note');
			err.id = '9725d0ce-ba28-4dde-95a7-2cbb2c15de24';
			getterService.getNote.mockRejectedValue(err);

			await expect(callEndpoint()).rejects.toMatchObject({ code: 'NO_SUCH_NOTE' });
		});

		it('isVisibleForMeがfalseならCANNOT_TRANSLATE_INVISIBLE_NOTE', async () => {
			await buildModule(deeplSettings);
			roleService.getUserPolicies.mockResolvedValue({ canUseTranslator: true } as any);
			getterService.getNote.mockResolvedValue(targetNote);
			noteEntityService.isVisibleForMe.mockResolvedValue(false);

			await expect(callEndpoint()).rejects.toMatchObject({
				code: 'CANNOT_TRANSLATE_INVISIBLE_NOTE',
			});
		});

		it('note.textがnullならundefinedを返す', async () => {
			await buildModule(deeplSettings);
			setHappyPath({ text: null, cw: null });

			await expect(callEndpoint()).resolves.toBeUndefined();
		});

		it('translatorType未設定ならNO_TRANSLATE_SERVICE', async () => {
			await buildModule({ translatorType: null });
			setHappyPath();

			await expect(callEndpoint()).rejects.toMatchObject({ code: 'NO_TRANSLATE_SERVICE' });
		});
	});

	describe('CW結合', () => {
		// note.cw が存在する場合 `cw + '\n' + text` が翻訳対象になる仕様
		it('CWがある時、DeepLには「cw\\ntext」が渡される', async () => {
			await buildModule(deeplSettings);
			setHappyPath({ text: '本文', cw: '注意' });
			httpRequestService.send.mockResolvedValue(deeplResponse('cw\nbody') as any);

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const [, options] = (httpRequestService.send as jest.Mock).mock.calls[0];
			const body = (options as any).body;
			// URLSearchParamsはエンコードするので decode して確認
			const decoded = decodeURIComponent(body);
			expect(decoded).toContain('text=注意\n本文');
		});

		it('CWがある時、ctav3 contents には「cw\\ntext」が単一要素として渡される', async () => {
			await buildModule(ctav3Settings);
			setHappyPath({ text: '本文', cw: '注意' });
			mockTranslateText.mockResolvedValue(ctav3SingleResponse('translated'));

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const callArg = (mockTranslateText as jest.Mock).mock.calls[0][0];
			expect((callArg as any).contents).toEqual(['注意\n本文']);
		});

		it('CWがある時、Libreにも「cw\\ntext」が渡される', async () => {
			await buildModule(libreSettings);
			setHappyPath({ text: '本文', cw: '注意' });
			httpRequestService.send.mockResolvedValue(libreResponse('translated') as any);

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const [, options] = (httpRequestService.send as jest.Mock).mock.calls[0];
			expect(JSON.parse((options as any).body).q).toBe('注意\n本文');
		});

		it('CWがnullなら text のみが渡される', async () => {
			await buildModule(deeplSettings);
			setHappyPath({ text: '本文だけ', cw: null });
			httpRequestService.send.mockResolvedValue(deeplResponse('body only') as any);

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const [, options] = (httpRequestService.send as jest.Mock).mock.calls[0];
			const decoded = decodeURIComponent((options as any).body);
			expect(decoded).toContain('text=本文だけ');
			expect(decoded).not.toContain('注意');
		});
	});

	describe('DeepL', () => {
		beforeEach(async () => {
			await buildModule(deeplSettings);
			setHappyPath();
		});

		it('Free版エンドポイントを叩く', async () => {
			httpRequestService.send.mockResolvedValue(deeplResponse('Hello, world') as any);
			const res = await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			expect(httpRequestService.send).toHaveBeenCalledWith(
				'https://api-free.deepl.com/v2/translate',
				expect.anything(),
			);
			expect(res).toMatchObject({ sourceLang: 'JA', text: 'Hello, world' });
		});

		it('Pro版フラグで有料エンドポイント', async () => {
			serverSettings.deeplIsPro = true;
			httpRequestService.send.mockResolvedValue(deeplResponse('Hello') as any);

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			expect(httpRequestService.send).toHaveBeenCalledWith(
				'https://api.deepl.com/v2/translate',
				expect.anything(),
			);
		});

		it('targetLangのリージョン部分を切り落とす', async () => {
			httpRequestService.send.mockResolvedValue(deeplResponse('x') as any);

			await callEndpoint({ noteId: 'n1', targetLang: 'en-US' });

			const [, options] = (httpRequestService.send as jest.Mock).mock.calls[0];
			expect((options as any).body).toContain('target_lang=en');
		});

		it('authKey未設定でUNAVAILABLE', async () => {
			serverSettings.deeplAuthKey = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});

	describe('Cloud Translation Advanced', () => {
		beforeEach(async () => {
			await buildModule(ctav3Settings);
			setHappyPath();
		});

		it('glossaryなしで翻訳できる', async () => {
			mockTranslateText.mockResolvedValue(ctav3SingleResponse('Hello'));
			const res = await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			expect(mockDetectLanguage).not.toHaveBeenCalled();
			expect(res).toMatchObject({ sourceLang: 'ja', text: 'Hello' });
		});

		it('glossary設定時はdetectLanguageを呼ぶ', async () => {
			serverSettings.ctav3Glossary = 'my-glossary';
			mockDetectLanguage.mockResolvedValue(ctav3DetectResponse('ja'));
			mockTranslateText.mockResolvedValue(ctav3SingleResponse('...'));

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const callArg = (mockTranslateText as jest.Mock).mock.calls[0][0];
			expect((callArg as any).targetLanguageCode).toBe('ja');
			expect((callArg as any).contents).toEqual(['こんにちは、世界']);
		});

		it('model指定時はmodel pathを組み立てる', async () => {
			serverSettings.ctav3Model = 'general/nmt';
			mockTranslateText.mockResolvedValue(ctav3SingleResponse('x'));

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const callArg = (mockTranslateText as jest.Mock).mock.calls[0][0];
			expect((callArg as any).model).toBe('projects/proj-1/locations/global/models/general/nmt');
		});

		it('必須設定欠落でUNAVAILABLE', async () => {
			serverSettings.ctav3SaKey = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});

	describe('LibreTranslate', () => {
		beforeEach(async () => {
			await buildModule(libreSettings);
			setHappyPath();
		});

		it('翻訳結果を返す', async () => {
			httpRequestService.send.mockResolvedValue(libreResponse('Hello') as any);
			const res = await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			expect(res).toMatchObject({ sourceLang: 'ja', text: 'Hello' });
		});

		it('APIキー設定時はbodyに含める', async () => {
			serverSettings.libreTranslateApiKey = 'libre-key';
			httpRequestService.send.mockResolvedValue(libreResponse('Hello') as any);

			await callEndpoint({ noteId: 'n1', targetLang: 'en' });

			const [, options] = (httpRequestService.send as jest.Mock).mock.calls[0];
			expect(JSON.parse((options as any).body)).toMatchObject({ api_key: 'libre-key' });
		});

		it('endpoint未設定でUNAVAILABLE', async () => {
			serverSettings.libreTranslateEndPoint = null;
			await expect(callEndpoint()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
		});
	});
});
