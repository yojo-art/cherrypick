/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URLSearchParams } from 'node:url';
import fs from 'node:fs';
import { Inject, Injectable } from '@nestjs/common';
import { TranslationServiceClient } from '@google-cloud/translate';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { createTemp } from '@/misc/create-temp.js';
import { RoleService } from '@/core/RoleService.js';
import { MiMeta } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import type { PollsRepository } from '@/models/_.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,
	kind: 'read:account',

	res: {
		type: 'object',
		optional: true, nullable: false,
		properties: {
			sourceLang: { type: 'string' },
			text: {
				type: 'array',
				optional: true, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: true,
				},
			},
		},
	},

	errors: {
		unavailable: {
			message: 'Translate of polls unavailable.',
			code: 'UNAVAILABLE',
			id: 'dc5ba5b7-0d50-4dcd-80f5-910f16a56b40',
		},
		noTranslateService: {
			message: 'Translate service is not available.',
			code: 'NO_TRANSLATE_SERVICE',
			id: 'bef6e895-c05d-4499-9815-035ed18b0e31',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		targetLang: { type: 'string' },
	},
	required: ['noteId', 'targetLang'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.meta)
		private serverSettings: MiMeta,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		private httpRequestService: HttpRequestService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(me.id);
			if (!policies.canUseTranslator) {
				throw new ApiError(meta.errors.unavailable);
			}

			const poll = await this.pollsRepository.findOneByOrFail({ noteId: ps.noteId });

			if (poll.choices == null) {
				return;
			}

			let targetLang = ps.targetLang;
			if (targetLang.includes('-')) targetLang = targetLang.split('-')[0];

			let translationResult;

			const translatorType = this.serverSettings.translatorType?.toLowerCase() ?? null;
			switch (translatorType) {
				case 'deepl': {
					if (this.serverSettings.deeplAuthKey == null) {
						throw new ApiError(meta.errors.unavailable);
					}
					translationResult = await this.translateDeepL(
						poll.choices,
						targetLang,
						this.serverSettings.deeplAuthKey,
						this.serverSettings.deeplIsPro,
						translatorType);
					break;
				}
				case 'ctav3': {
					if (this.serverSettings.ctav3SaKey == null || this.serverSettings.ctav3ProjectId == null || this.serverSettings.ctav3Location == null) {
						throw new ApiError(meta.errors.unavailable);
					}

					translationResult = await this.apiCloudTranslationAdvanced(
						poll.choices,
						targetLang,
						this.serverSettings.ctav3SaKey,
						this.serverSettings.ctav3ProjectId,
						this.serverSettings.ctav3Location,
						this.serverSettings.ctav3Model,
						this.serverSettings.ctav3Glossary,
						translatorType);
					break;
				}
				case 'libretranslate': {
					const endPoint = this.serverSettings.libreTranslateEndPoint;
					if (endPoint === null) {
						throw new ApiError(meta.errors.unavailable);
					}
					translationResult = await this.translateLibretranslate(
						poll.choices,
						targetLang,
						endPoint,
						this.serverSettings.libreTranslateApiKey,
						translatorType);
					break;
				}
				default:
					throw new ApiError(meta.errors.noTranslateService);
			}

			return Promise.resolve({
				sourceLang: translationResult.sourceLang || '',
				text: translationResult.text || [],
				translator: translationResult.translator || [],
			});
		});
	}

	private async translateDeepL(text: string[], targetLang: string, authKey: string, isPro: boolean, provider: string) {
		const params = new URLSearchParams();
		params.append('auth_key', authKey);
		params.append('target_lang', targetLang);

		const translations = [];

		for (const t of text) {
			params.set('text', t);
			const endpoint = isPro ? 'https://api.deepl.com/v2/translate' : 'https://api-free.deepl.com/v2/translate';
			const res = await this.httpRequestService.send(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json, */*',
				},
				body: params.toString(),
			});

			const json = (await res.json()) as {
				translations: {
					detected_source_language: string;
					text: string;
				}[];
			};

			translations.push({
				translatedText: json.translations[0]?.text || '',
				sourceLang: json.translations[0]?.detected_source_language || '',
			});
		}

		return {
			sourceLang: translations[0]?.sourceLang || '',
			text: translations.map(choice => choice.translatedText),
			translator: provider,
		};
	}

	private async apiCloudTranslationAdvanced(text: string[], targetLang: string, saKey: string, projectId: string, location: string, model: string | null, glossary: string | null, provider: string) {
		const [path, cleanup] = await createTemp();
		fs.writeFileSync(path, saKey);

		const translationClient = new TranslationServiceClient({ keyFilename: path });

		const detectText = text.join('\n');
		const detectRequest = {
			parent: `projects/${projectId}/locations/${location}`,
			content: detectText,
		};

		let detectedLanguage = null;
		let glossaryConfig = null;
		if (glossary !== '' && glossary !== null) {
			glossaryConfig = {
				glossary: `projects/${projectId}/locations/${location}/glossaries/${glossary}`,
			};
			const [detectResponse] = await translationClient.detectLanguage(detectRequest);
			detectedLanguage = detectResponse.languages && detectResponse.languages[0]?.languageCode;
		}

		let modelConfig = null;
		if (model !== '' && model !== null) {
			modelConfig = `projects/${projectId}/locations/${location}/models/${model}`;
		}

		const translateRequest = {
			parent: `projects/${projectId}/locations/${location}`,
			contents: text,
			mimeType: 'text/plain',
			sourceLanguageCode: null,
			targetLanguageCode: detectedLanguage !== null ? detectedLanguage : targetLang,
			model: modelConfig,
			glossaryConfig: glossaryConfig,
		};
		const [translateResponse] = await translationClient.translateText(translateRequest);
		const translatedText = translateResponse.translations && translateResponse.translations.map(t => t.translatedText ?? '');
		const detectedLanguageCode = translateResponse.translations && translateResponse.translations[0]?.detectedLanguageCode;

		cleanup();

		return {
			sourceLang: detectedLanguage !== null ? detectedLanguage : detectedLanguageCode,
			text: translatedText,
			translator: provider,
		};
	}

	private async translateLibretranslate(texts: string[], targetLang: string, endpoint: string, apiKey:string | null, provider:string ) {
		const translations = [];
		const target = targetLang.split('-')[0];
		for (const text of texts) {
			const res = await this.httpRequestService.send(endpoint + '/translate', {
				method: 'POST',
				body: JSON.stringify({
					q: text,
					source: 'auto',
					format: 'text',
					target: target,
					...(apiKey ? { api_key: apiKey } : { }),
				}),
				headers: { 'Content-Type': 'application/json' },
			});

			const json = (await res.json()) as {
				translatedText: string,
				detectedLanguage: {
					confidence: number,
					language: string,
				}
				error: string,
			};
			translations.push({
				translatedText: json.translatedText || '',
				sourceLang: json.detectedLanguage.language || '',
			});
		}

		return {
			sourceLang: translations[0]?.sourceLang || '',
			text: translations.map(choice => choice.translatedText),
			translator: provider,
		};
	}
}
