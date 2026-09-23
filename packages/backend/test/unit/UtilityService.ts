/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { UtilityService } from '@/core/UtilityService.js';
import type { Config } from '@/config.js';
import type { MiMeta } from '@/models/Meta.js';

process.env.NODE_ENV = 'test';

function createService(allowedPrivateNetworks?: string[]): UtilityService {
	return new UtilityService({ allowedPrivateNetworks } as unknown as Config, {} as unknown as MiMeta);
}

describe('UtilityService:isValidRemoteHost', () => {
	test('accepts public host names and public IP literals', () => {
		const service = createService();
		expect(service.isValidRemoteHost('example.com')).toBe(true);
		expect(service.isValidRemoteHost('example.com:8443')).toBe(true);
		expect(service.isValidRemoteHost('8.8.8.8')).toBe(true);
		expect(service.isValidRemoteHost('[2001:4860:4860::8888]')).toBe(true);
	});

	test('rejects hosts containing a path, query, fragment or userinfo', () => {
		const service = createService();
		expect(service.isValidRemoteHost('example.com/path')).toBe(false);
		expect(service.isValidRemoteHost('example.com/anything#')).toBe(false);
		expect(service.isValidRemoteHost('example.com?query=1')).toBe(false);
		expect(service.isValidRemoteHost('example.com#fragment')).toBe(false);
		expect(service.isValidRemoteHost('user:pass@example.com')).toBe(false);
		expect(service.isValidRemoteHost('')).toBe(false);
	});

	test('rejects private, loopback and link-local IP literals', () => {
		const service = createService();
		expect(service.isValidRemoteHost('127.0.0.1')).toBe(false);
		expect(service.isValidRemoteHost('127.0.0.1:8443')).toBe(false);
		expect(service.isValidRemoteHost('10.0.0.1')).toBe(false);
		expect(service.isValidRemoteHost('172.16.0.1')).toBe(false);
		expect(service.isValidRemoteHost('192.168.0.1')).toBe(false);
		expect(service.isValidRemoteHost('169.254.169.254')).toBe(false);
		expect(service.isValidRemoteHost('[::1]')).toBe(false);
		expect(service.isValidRemoteHost('[fc00::1]')).toBe(false);
		expect(service.isValidRemoteHost('[::ffff:127.0.0.1]')).toBe(false);
		// URL 正規化により 127.0.0.1 になる表記
		expect(service.isValidRemoteHost('2130706433')).toBe(false);
		expect(service.isValidRemoteHost('0x7f000001')).toBe(false);
	});

	test('respects config.allowedPrivateNetworks', () => {
		const service = createService(['127.0.0.0/8']);
		expect(service.isValidRemoteHost('127.0.0.1')).toBe(true);
		expect(service.isValidRemoteHost('10.0.0.1')).toBe(false);
	});
});
