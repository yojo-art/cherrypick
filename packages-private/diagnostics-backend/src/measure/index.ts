/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readBooleanEnv, readIntegerEnv } from 'diagnostics-shared/env';
import { analyzeHeapSnapshot, defaultHeapSnapshotBreakdownTopN, type HeapSnapshotData } from 'diagnostics-shared/heap-snapshot';
import { getMemoryUsage, getSmapsRollupMemoryUsage } from './proc';
import {
	forkBackendServer,
	getRuntimeMemoryUsage,
	requestHeapSnapshot,
	shutdownBackendServer,
	triggerGc,
	waitForServerReady,
} from './server';
import { measureMemoryUntilStable } from './stability';
import type { MemorySample } from '../types';

export type MeasureBackendMemoryOptions = {
	/** heap snapshotを取得するか (既定: MK_MEMORY_HEAP_SNAPSHOT) */
	heapSnapshot?: boolean;
	/** 取得したheap snapshotの保存先。未指定なら解析後に破棄する */
	heapSnapshotSavePath?: string | null;
	heapSnapshotBreakdownTopN?: number;
	heapSnapshotTimeoutMs?: number;
	startupTimeoutMs?: number;
	ipcTimeoutMs?: number;
};

function resolveOptions(options: MeasureBackendMemoryOptions) {
	return {
		heapSnapshot: options.heapSnapshot ?? readBooleanEnv('MK_MEMORY_HEAP_SNAPSHOT', false),
		heapSnapshotSavePath: options.heapSnapshotSavePath ?? null,
		heapSnapshotBreakdownTopN: options.heapSnapshotBreakdownTopN ?? readIntegerEnv('MK_MEMORY_HEAP_SNAPSHOT_BREAKDOWN_TOP_N', defaultHeapSnapshotBreakdownTopN, 1),
		heapSnapshotTimeoutMs: options.heapSnapshotTimeoutMs ?? readIntegerEnv('MK_MEMORY_HEAP_SNAPSHOT_TIMEOUT_MS', 120000, 1),
		startupTimeoutMs: options.startupTimeoutMs ?? readIntegerEnv('MK_MEMORY_STARTUP_TIMEOUT_MS', 120000, 1),
		ipcTimeoutMs: options.ipcTimeoutMs ?? readIntegerEnv('MK_MEMORY_IPC_TIMEOUT_MS', 30000, 1),
	};
}

/**
 * バックエンドを1回起動し、GC後のメモリ使用量を計測して1サンプル分の結果を返す。
 */
export async function measureBackendMemory(backendDir: string, options: MeasureBackendMemoryOptions = {}): Promise<MemorySample> {
	const settings = resolveOptions(options);
	const serverProcess = forkBackendServer(backendDir);

	// 起動完了メッセージを取りこぼさないよう、他のハンドラより先に待ち受ける
	const serverReady = waitForServerReady(serverProcess, settings.startupTimeoutMs);

	serverProcess.stdout?.on('data', (data) => {
		process.stderr.write(`[server stdout] ${data}`);
	});

	serverProcess.stderr?.on('data', (data) => {
		process.stderr.write(`[server stderr] ${data}`);
	});

	serverProcess.on('error', (err) => {
		process.stderr.write(`[server error] ${err}\n`);
	});

	// 途中で失敗しても子プロセスを残さない。残すと次のラウンドがポート衝突で落ちる
	try {
		const startupStartTime = Date.now();
		await serverReady;

		const startupTime = Date.now() - startupStartTime;
		process.stderr.write(`Server started in ${startupTime}ms\n`);

		await triggerGc(serverProcess, settings.ipcTimeoutMs);

		const pid = serverProcess.pid!;
		const stableSmapsRollup = await measureMemoryUntilStable(() => getSmapsRollupMemoryUsage(pid));
		const afterGc = {
			memoryUsage: {
				...await getMemoryUsage(pid),
				...stableSmapsRollup.memoryUsage,
				...await getRuntimeMemoryUsage(serverProcess, settings.ipcTimeoutMs),
			},
			stability: stableSmapsRollup.stability,
		};
		process.stderr.write(`Memory ${afterGc.stability.converged ? 'stabilized' : 'did not stabilize'} after ${afterGc.stability.readingCount} readings over ${Math.round(afterGc.stability.elapsedMs)}ms\n`);

		const heapSnapshotAfterGc = await getHeapSnapshotStatistics(serverProcess, settings);

		return {
			timestamp: new Date().toISOString(),
			phases: {
				afterGc: {
					memoryUsage: afterGc.memoryUsage,
					memoryStability: afterGc.stability,
					heapSnapshot: heapSnapshotAfterGc,
				},
			},
		};
	} finally {
		await shutdownBackendServer(serverProcess);
	}
}

async function getHeapSnapshotStatistics(
	serverProcess: ReturnType<typeof forkBackendServer>,
	settings: ReturnType<typeof resolveOptions>,
): Promise<HeapSnapshotData | null> {
	if (!settings.heapSnapshot) return null;

	const snapshotPath = join(tmpdir(), `misskey-backend-heap-${process.pid}-${serverProcess.pid}-${Date.now()}.heapsnapshot`);
	const writtenPath = await requestHeapSnapshot(serverProcess, snapshotPath, settings.heapSnapshotTimeoutMs);

	try {
		if (settings.heapSnapshotSavePath != null && settings.heapSnapshotSavePath !== '') {
			await fs.mkdir(dirname(settings.heapSnapshotSavePath), { recursive: true });
			await fs.copyFile(writtenPath, settings.heapSnapshotSavePath);
		}

		const snapshotStat = await fs.stat(writtenPath).catch((err: unknown) => {
			throw new Error(`Failed to stat heap snapshot ${writtenPath} (requested ${snapshotPath}): ${err instanceof Error ? err.message : String(err)}`);
		});
		if (snapshotStat.size === 0) {
			throw new Error(`Heap snapshot is empty (0 bytes): ${writtenPath} (requested ${snapshotPath}). The backend may have failed to write it (disk full, OOM during snapshot requiring ~2x heap, or clustering not disabled).`);
		}

		const raw = await fs.readFile(writtenPath, 'utf-8');
		if (raw.trim().length === 0) {
			throw new Error(`Heap snapshot is blank (size=${snapshotStat.size} bytes): ${writtenPath}`);
		}
		let snapshot: unknown;
		try {
			snapshot = JSON.parse(raw);
		} catch (err) {
			throw new Error(`Failed to parse heap snapshot ${writtenPath} (size=${snapshotStat.size} bytes, requested ${snapshotPath}): ${err instanceof Error ? err.message : String(err)}`);
		}
		return analyzeHeapSnapshot(snapshot as HeapSnapshotData, { breakdownTopN: settings.heapSnapshotBreakdownTopN });
	} finally {
		// 数百MBになることがあるため、解析後は必ず消す
		await fs.unlink(writtenPath).catch(err => {
			process.stderr.write(`Failed to delete heap snapshot ${writtenPath}: ${err.message}\n`);
		});
	}
}
