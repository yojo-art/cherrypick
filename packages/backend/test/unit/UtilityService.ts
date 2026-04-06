/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Test } from '@nestjs/testing';
import { describe, expect, test, beforeAll } from '@jest/globals';
import { CoreModule } from '@/core/CoreModule.js';
import { UtilityService } from '@/core/UtilityService.js';
import { GlobalModule } from '@/GlobalModule.js';

describe('UtilityService', () => {
	let utilityService: UtilityService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		utilityService = app.get<UtilityService>(UtilityService);
	});

	describe('getFullApAccount', () => {
		test('with host', () => {
			const result = utilityService.getFullApAccount('user', 'example.com');
			expect(result).toBe('user@example.com');
		});

		test('without host (local)', () => {
			const result = utilityService.getFullApAccount('user', null);
			expect(result).toContain('user@');
		});
	});

	describe('isSelfHost', () => {
		test('null host is self', () => {
			expect(utilityService.isSelfHost(null)).toBe(true);
		});

		test('different host is not self', () => {
			expect(utilityService.isSelfHost('other.example.com')).toBe(false);
		});
	});

	describe('isUriLocal', () => {
		test('local URI', () => {
			expect(utilityService.isUriLocal('http://cherrypick.local/users/1')).toBe(true);
		});

		test('remote URI', () => {
			expect(utilityService.isUriLocal('https://remote.example.com/users/1')).toBe(false);
		});
	});

	describe('validateEmailFormat', () => {
		test('valid email', () => {
			expect(utilityService.validateEmailFormat('user@example.com')).toBe(true);
		});

		test('invalid email without @', () => {
			expect(utilityService.validateEmailFormat('userexample.com')).toBe(false);
		});

		test('invalid email without domain', () => {
			expect(utilityService.validateEmailFormat('user@')).toBe(false);
		});

		test('empty string', () => {
			expect(utilityService.validateEmailFormat('')).toBe(false);
		});
	});

	describe('isBlockedHost', () => {
		test('blocked host', () => {
			expect(utilityService.isBlockedHost(['blocked.com'], 'blocked.com')).toBe(true);
		});

		test('subdomain of blocked host', () => {
			expect(utilityService.isBlockedHost(['blocked.com'], 'sub.blocked.com')).toBe(true);
		});

		test('not blocked host', () => {
			expect(utilityService.isBlockedHost(['blocked.com'], 'safe.com')).toBe(false);
		});

		test('null host', () => {
			expect(utilityService.isBlockedHost(['blocked.com'], null)).toBe(false);
		});
	});

	describe('isSilencedHost', () => {
		test('silenced host', () => {
			expect(utilityService.isSilencedHost(['silenced.com'], 'silenced.com')).toBe(true);
		});

		test('not silenced', () => {
			expect(utilityService.isSilencedHost(['silenced.com'], 'safe.com')).toBe(false);
		});

		test('null host', () => {
			expect(utilityService.isSilencedHost(['silenced.com'], null)).toBe(false);
		});

		test('undefined silenced hosts', () => {
			expect(utilityService.isSilencedHost(undefined, 'any.com')).toBe(false);
		});
	});

	describe('isMediaSilencedHost', () => {
		test('silenced host (exact match)', () => {
			expect(utilityService.isMediaSilencedHost(['silenced.com'], 'silenced.com')).toBe(true);
		});

		test('subdomain is not matched', () => {
			expect(utilityService.isMediaSilencedHost(['silenced.com'], 'sub.silenced.com')).toBe(false);
		});

		test('null host', () => {
			expect(utilityService.isMediaSilencedHost(['silenced.com'], null)).toBe(false);
		});

		test('undefined list', () => {
			expect(utilityService.isMediaSilencedHost(undefined, 'any.com')).toBe(false);
		});
	});

	describe('concatNoteContentsForKeyWordCheck', () => {
		test('with all fields', () => {
			const result = utilityService.concatNoteContentsForKeyWordCheck({
				cw: 'cw',
				text: 'text',
				pollChoices: ['a', 'b'],
				others: ['c'],
			});
			expect(result).toContain('cw');
			expect(result).toContain('text');
			expect(result).toContain('a');
			expect(result).toContain('b');
			expect(result).toContain('c');
		});

		test('with null fields', () => {
			const result = utilityService.concatNoteContentsForKeyWordCheck({
				cw: null,
				text: null,
				pollChoices: null,
				others: null,
			});
			expect(typeof result).toBe('string');
		});
	});

	describe('isKeyWordIncluded', () => {
		test('keyword match', () => {
			expect(utilityService.isKeyWordIncluded('hello world', ['hello'])).toBe(true);
		});

		test('no match', () => {
			expect(utilityService.isKeyWordIncluded('hello world', ['goodbye'])).toBe(false);
		});

		test('empty keywords', () => {
			expect(utilityService.isKeyWordIncluded('hello', [])).toBe(false);
		});

		test('empty text', () => {
			expect(utilityService.isKeyWordIncluded('', ['hello'])).toBe(false);
		});

		test('multi-word filter (all words must match)', () => {
			expect(utilityService.isKeyWordIncluded('hello world foo', ['hello world'])).toBe(true);
			expect(utilityService.isKeyWordIncluded('hello foo', ['hello world'])).toBe(false);
		});

		test('regex filter', () => {
			expect(utilityService.isKeyWordIncluded('test123', ['/test\\d+/'])).toBe(true);
			expect(utilityService.isKeyWordIncluded('hello', ['/test\\d+/'])).toBe(false);
		});
	});

	describe('extractDbHost', () => {
		test('extracts host from URI', () => {
			const result = utilityService.extractDbHost('https://example.com/path');
			expect(result).toBe('example.com');
		});
	});

	describe('toPuny', () => {
		test('ASCII host unchanged', () => {
			expect(utilityService.toPuny('example.com')).toBe('example.com');
		});

		test('uppercase to lowercase', () => {
			expect(utilityService.toPuny('EXAMPLE.COM')).toBe('example.com');
		});
	});

	describe('toPunyNullable', () => {
		test('null returns null', () => {
			expect(utilityService.toPunyNullable(null)).toBe(null);
		});

		test('undefined returns null', () => {
			expect(utilityService.toPunyNullable(undefined)).toBe(null);
		});

		test('host is converted', () => {
			expect(utilityService.toPunyNullable('EXAMPLE.COM')).toBe('example.com');
		});
	});

	describe('punyHost', () => {
		test('extracts and converts host', () => {
			const result = utilityService.punyHost('https://Example.COM/path');
			expect(result).toBe('example.com');
		});

		test('preserves port', () => {
			const result = utilityService.punyHost('https://example.com:8080/path');
			expect(result).toBe('example.com:8080');
		});
	});

	describe('isDeliverSuspendedSoftware', () => {
		test('null software name returns undefined', () => {
			expect(utilityService.isDeliverSuspendedSoftware({
				softwareName: null,
				softwareVersion: null,
			})).toBeUndefined();
		});

		test('unknown software returns undefined', () => {
			expect(utilityService.isDeliverSuspendedSoftware({
				softwareName: 'unknown-software',
				softwareVersion: '1.0.0',
			})).toBeUndefined();
		});
	});
});
