/**
 * Move endpoint test files from src/ to test/unit/ and fix import paths.
 * Run: node scripts/move-endpoint-tests.cjs
 */

const fs = require('fs');
const path = require('path');

const srcBase = 'src/server/api/endpoints';
const destBase = 'test/unit/server/api/endpoints';

// 既存のテスト(upstream由来)は除外
const exclude = new Set([
	'src/server/api/endpoints/notes/create.test.ts',
	'src/server/api/endpoints/users/show.test.ts',
]);

function walkDir(dir) {
	const files = [];
	if (!fs.existsSync(dir)) return files;
	for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, f.name);
		if (f.isDirectory()) {
			files.push(...walkDir(full));
		} else if (f.name.endsWith('.test.ts')) {
			files.push(full);
		}
	}
	return files;
}

const testFiles = walkDir(srcBase).filter(f => !exclude.has(f));
let moved = 0;

for (const srcFile of testFiles) {
	// 移動先パスを計算
	const relFromSrcBase = path.relative(srcBase, srcFile);
	const destFile = path.join(destBase, relFromSrcBase);

	// 読み込み
	let content = fs.readFileSync(srcFile, 'utf-8');

	// 1. getValidatorのimportパスを修正
	// 古いパス: 相対パスで test/prelude/ を指している (例: '../../../../../../test/prelude/get-api-validator.js')
	// 新しいパス: test/unit/server/api/endpoints/xxx/ から test/prelude/ への相対パス
	const destDir = path.dirname(destFile);
	const preludePath = path.relative(destDir, 'test/prelude').replace(/\\/g, '/');
	content = content.replace(
		/import \{ getValidator \} from '[^']+\/get-api-validator\.js';/,
		`import { getValidator } from '${preludePath}/get-api-validator.js';`
	);

	// 2. paramDefのimportパスを修正
	// 古いパス: './create.js' (同じディレクトリの相対パス)
	// 新しいパス: '@/server/api/endpoints/xxx/create.js' (エイリアスパス)
	const srcDir = path.dirname(srcFile);
	content = content.replace(
		/import \{ paramDef \} from '\.\/([^']+)';/,
		(match, filename) => {
			const srcModule = path.join(srcDir, filename).replace(/\\/g, '/');
			// src/ を @/ に変換
			const aliasPath = srcModule.replace(/^src\//, '@/');
			return `import { paramDef } from '${aliasPath}';`;
		}
	);

	// ディレクトリ作成 & 書き込み
	fs.mkdirSync(path.dirname(destFile), { recursive: true });
	fs.writeFileSync(destFile, content);

	// 元ファイル削除
	fs.unlinkSync(srcFile);
	moved++;
}

// 空ディレクトリを再帰的に削除
function removeEmptyDirs(dir) {
	if (!fs.existsSync(dir)) return;
	const entries = fs.readdirSync(dir);
	for (const entry of entries) {
		const full = path.join(dir, entry);
		if (fs.statSync(full).isDirectory()) {
			removeEmptyDirs(full);
		}
	}
	if (fs.readdirSync(dir).length === 0) {
		fs.rmdirSync(dir);
	}
}

// src側の空ディレクトリ掃除 (テストファイルだけあったディレクトリ)
// ※ソースファイルがあるディレクトリは消さない

console.log(`Moved: ${moved} files`);
console.log(`From: ${srcBase} → To: ${destBase}`);
