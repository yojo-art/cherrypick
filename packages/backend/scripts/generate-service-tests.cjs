/**
 * Generates service instantiation tests for core/entities, core/activitypub, core/chart, queue/processors.
 * These tests verify that services can be properly instantiated through NestJS DI.
 * Run: node scripts/generate-service-tests.cjs
 */

const fs = require('fs');
const path = require('path');

const dirs = [
	{ dir: 'src/core', testDir: 'test/unit/core', importBase: '@/core' },
	{ dir: 'src/core/entities', testDir: 'test/unit/entities', importBase: '@/core/entities' },
	{ dir: 'src/core/activitypub', testDir: 'test/unit/activitypub', importBase: '@/core/activitypub' },
	{ dir: 'src/core/activitypub/models', testDir: 'test/unit/activitypub/models', importBase: '@/core/activitypub/models' },
	{ dir: 'src/core/chart/charts', testDir: 'test/unit/chart/charts', importBase: '@/core/chart/charts' },
];

let generated = 0;
let skipped = 0;

for (const { dir, testDir, importBase } of dirs) {
	if (!fs.existsSync(dir)) continue;

	const files = fs.readdirSync(dir).filter(f =>
		f.endsWith('.ts') &&
		!f.endsWith('.test.ts') &&
		!f.endsWith('.d.ts') &&
		!f.startsWith('index') &&
		fs.statSync(path.join(dir, f)).isFile()
	);

	for (const file of files) {
		const content = fs.readFileSync(path.join(dir, file), 'utf-8');

		// Extract class name - look for "export class" or "export default class"
		const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+)/);
		if (!classMatch) continue;

		const className = classMatch[1];
		const baseName = file.replace('.ts', '');
		const testFile = path.join(testDir, `${baseName}.ts`);

		// Check if test already exists (in any known location)
		const existingTestPaths = [
			testFile,
			`test/unit/${baseName}.ts`,
			`test/unit/core/${baseName}.ts`,
		];
		if (existingTestPaths.some(p => fs.existsSync(p))) {
			skipped++;
			continue;
		}

		// Check if it's a default export (chart classes use default export)
		const isDefault = content.includes('export default class');

		fs.mkdirSync(testDir, { recursive: true });

		const importStatement = isDefault
			? `import ${className} from '${importBase}/${baseName}.js';`
			: `import { ${className} } from '${importBase}/${baseName}.js';`;

		const testContent = `/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, beforeAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
${importStatement}
import { GlobalModule } from '@/GlobalModule.js';

describe('${className}', () => {
	let service: ${className};

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		service = app.get<${className}>(${className});
	});

	test('should be defined', () => {
		expect(service).toBeDefined();
	});
});
`;

		fs.writeFileSync(testFile, testContent);
		generated++;
	}
}

console.log(`Generated: ${generated}, Skipped: ${skipped}`);
