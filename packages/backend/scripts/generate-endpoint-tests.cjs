/**
 * Generates .test.ts files for API endpoint paramDef validation.
 * Run: node scripts/generate-endpoint-tests.js
 */

const fs = require('fs');
const path = require('path');

function walkDir(dir) {
	const files = [];
	for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
		if (f.isDirectory()) {
			files.push(...walkDir(path.join(dir, f.name)));
		} else if (f.name.endsWith('.ts') && !f.name.endsWith('.test.ts')) {
			files.push(path.join(dir, f.name));
		}
	}
	return files;
}

function getRelativeTestImportPath(testFilePath, endpointsDir) {
	const rel = path.relative(path.dirname(testFilePath), 'test/prelude');
	return rel.replace(/\\/g, '/');
}

function generateValidValue(propSchema) {
	if (!propSchema) return undefined;
	const type = propSchema.type;
	if (propSchema.enum && propSchema.enum.length > 0) return JSON.stringify(propSchema.enum[0]);
	if (propSchema.const !== undefined) return JSON.stringify(propSchema.const);
	if (type === 'string') {
		if (propSchema.format === 'misskey:id') return "'aaaaaaaaaaa'";
		if (propSchema.format === 'url') return "'https://example.com'";
		if (propSchema.format === 'uri') return "'https://example.com'";
		if (propSchema.format === 'email') return "'test@example.com'";
		if (propSchema.format === 'date-time') return "'2024-01-01T00:00:00.000Z'";
		return "'test'";
	}
	if (type === 'number' || type === 'integer') return '1';
	if (type === 'boolean') return 'true';
	if (type === 'array') return '[]';
	if (type === 'object') return '{}';
	if (Array.isArray(type)) {
		// nullable types like ['string', 'null']
		const nonNull = type.find(t => t !== 'null');
		if (nonNull === 'string') return "'test'";
		if (nonNull === 'number' || nonNull === 'integer') return '1';
		if (nonNull === 'boolean') return 'true';
	}
	return "'test'";
}

function parseParamDef(content) {
	// Extract the paramDef object
	const match = content.match(/export const paramDef\s*=\s*(\{[\s\S]*?\})\s*as\s*const/);
	if (!match) return null;

	try {
		// Simple extraction of required and properties
		const defStr = match[1];

		// Extract required array
		const requiredMatch = defStr.match(/required\s*:\s*\[([\s\S]*?)\]/);
		const required = [];
		if (requiredMatch && requiredMatch[1].trim()) {
			const items = requiredMatch[1].match(/'([^']+)'/g);
			if (items) {
				for (const item of items) {
					required.push(item.replace(/'/g, ''));
				}
			}
		}

		// Extract properties
		const properties = {};
		// Find properties block
		const propsMatch = defStr.match(/properties\s*:\s*\{/);
		if (propsMatch) {
			const propsStart = defStr.indexOf(propsMatch[0]) + propsMatch[0].length;
			let depth = 1;
			let i = propsStart;
			while (i < defStr.length && depth > 0) {
				if (defStr[i] === '{') depth++;
				if (defStr[i] === '}') depth--;
				i++;
			}
			const propsBlock = defStr.slice(propsStart, i - 1);

			// Extract each property name and its type
			const propRegex = /(\w+)\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
			let propMatch;
			while ((propMatch = propRegex.exec(propsBlock)) !== null) {
				const propName = propMatch[1];
				const propBody = propMatch[2];

				const typeMatch = propBody.match(/type\s*:\s*'(\w+)'/);
				const formatMatch = propBody.match(/format\s*:\s*'([^']+)'/);
				const enumMatch = propBody.match(/enum\s*:\s*\[([^\]]+)\]/);

				const prop = {};
				if (typeMatch) prop.type = typeMatch[1];
				if (formatMatch) prop.format = formatMatch[1];
				if (enumMatch) {
					const enumValues = enumMatch[1].match(/'([^']+)'/g);
					if (enumValues) prop.enum = enumValues.map(v => v.replace(/'/g, ''));
				}

				properties[propName] = prop;
			}
		}

		return { required, properties };
	} catch (e) {
		return null;
	}
}

function generateTestContent(file, endpointName, paramInfo) {
	const baseName = path.basename(file, '.ts');
	const testPreludePath = path.relative(path.dirname(file), 'test/prelude').replace(/\\/g, '/');
	const importSuffix = './' + baseName + '.js';

	const lines = [];
	lines.push(`/*`);
	lines.push(` * SPDX-FileCopyrightText: syuilo and misskey-project`);
	lines.push(` * SPDX-License-Identifier: AGPL-3.0-only`);
	lines.push(` */`);
	lines.push(``);
	lines.push(`process.env.NODE_ENV = 'test';`);
	lines.push(``);
	lines.push(`import { getValidator } from '${testPreludePath}/get-api-validator.js';`);
	lines.push(`import { paramDef } from '${importSuffix}';`);
	lines.push(``);
	lines.push(`const VALID = true;`);
	lines.push(`const INVALID = false;`);
	lines.push(``);
	lines.push(`describe('api:${endpointName}', () => {`);
	lines.push(`\tdescribe('validation', () => {`);
	lines.push(`\t\tconst v = getValidator(paramDef);`);
	lines.push(``);

	if (!paramInfo || !paramInfo.required || paramInfo.required.length === 0) {
		lines.push(`\t\ttest('accept empty', () => expect(v({})).toBe(VALID));`);
	} else {
		lines.push(`\t\ttest('reject empty', () => expect(v({})).toBe(INVALID));`);
	}

	// Always test that the validator is a function (ensures paramDef is valid schema)
	lines.push(`\t\ttest('validator is a function', () => expect(typeof v).toBe('function'));`);

	lines.push(`\t});`);
	lines.push(`});`);
	lines.push(``);

	return lines.join('\n');
}

// Main
const endpointsDir = 'src/server/api/endpoints';
const allFiles = walkDir(endpointsDir);
let generated = 0;
let skipped = 0;

for (const file of allFiles) {
	const testFile = file.replace('.ts', '.test.ts');
	if (fs.existsSync(testFile)) {
		skipped++;
		continue;
	}

	const content = fs.readFileSync(file, 'utf-8');
	if (!content.includes('paramDef')) {
		continue;
	}

	// Determine endpoint name from file path
	const endpointName = file
		.replace(endpointsDir + '/', '')
		.replace('.ts', '')
		.replace(/\//g, '/');

	const paramInfo = parseParamDef(content);
	const testContent = generateTestContent(file, endpointName, paramInfo);

	fs.writeFileSync(testFile, testContent);
	generated++;
}

console.log(`Generated: ${generated}, Skipped (already exist): ${skipped}`);
