/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { GlobalModule } from '@/GlobalModule.js';
import { loadConfig } from '@/config.js';
import { genOpenapiSpec } from '@/server/api/openapi/gen-spec.js';

describe('OpenAPI gen-spec', () => {
	test('genOpenapiSpec returns valid spec object', () => {
		const config = loadConfig();
		const spec = genOpenapiSpec(config);
		expect(spec).toBeDefined();
		expect(spec.openapi).toBe('3.1.0');
		expect(spec.info).toBeDefined();
		expect(spec.info.title).toBeDefined();
		expect(spec.paths).toBeDefined();
		expect(spec.components).toBeDefined();
		expect(spec.components.schemas).toBeDefined();
	});

	test('genOpenapiSpec with includeSelfRef', () => {
		const config = loadConfig();
		const spec = genOpenapiSpec(config, true);
		expect(spec).toBeDefined();
		expect(spec.openapi).toBe('3.1.0');
	});

	test('spec has paths for endpoints', () => {
		const config = loadConfig();
		const spec = genOpenapiSpec(config);
		const pathCount = Object.keys(spec.paths).length;
		expect(pathCount).toBeGreaterThan(0);
	});

	test('spec has security schemes', () => {
		const config = loadConfig();
		const spec = genOpenapiSpec(config);
		expect(spec.components.securitySchemes).toBeDefined();
		expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
	});
});
