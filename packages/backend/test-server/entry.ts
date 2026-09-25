import { setupCoverage, startCoverage } from './coverage.js';
import type { TestProject } from 'vitest/node';

// NestJSのデコレータ適用などモジュール評価時に走るコードも計測対象にするため、
// サーバ本体を読み込む前に開始する
startCoverage();

guardPrepareStackTrace();

/**
 * サーバはvitestのメインプロセスで動くため、Errorのスタック整形にはViteのmodule runnerが
 * 差し込んだ `Error.prepareStackTrace` (sourcemapでの位置変換) が使われる。
 * Node 26 + カバレッジ計測の組み合わせでは、この中でサーバのチャンクに埋め込まれたsourcemapの
 * 抽出が `RangeError: Maximum call stack size exceeded` で失敗することがある。
 * `error.stack` を自前で読むライブラリ (gotのRequestErrorなど) ではこの例外が捕捉されずに
 * プロセスごと落ちてしまうため、失敗時は位置変換なしのスタックへフォールバックさせる。
 */
function guardPrepareStackTrace() {
	const prepare = Error.prepareStackTrace;
	if (prepare == null) return;

	Error.prepareStackTrace = (error, callSites) => {
		try {
			return prepare(error, callSites);
		} catch {
			return `${String(error)}${callSites.map(callSite => `\n    at ${callSite}`).join('')}`;
		}
	};
}

// 静的importにするとバンドル後に別チャンクの評価がこのファイルの本体より先に走り、
// startCoverage() が間に合わなくなるため動的importにしている
let serverModule: Promise<typeof import('./server.js')> | undefined;

function loadServer() {
	return serverModule ??= import('./server.js');
}

/**
 * テスト用のサーバインスタンスを起動する
 */
export async function setup(project: TestProject) {
	await setupCoverage(project);
	await (await loadServer()).setup();
}

/**
 * テスト用のサーバインスタンスを停止する
 */
export async function teardown() {
	await (await loadServer()).teardown();
}
