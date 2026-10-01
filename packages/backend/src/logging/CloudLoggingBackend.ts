/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import stripAnsi from 'strip-ansi';
import type { Log } from '@google-cloud/logging';
import type { LogBackend } from './LogBackend.js';
import type { LogLevel, LogRecord } from './types.js';

/** 送信失敗の報告方法など、CloudLoggingBackendが外部から受け取る依存関係です。 */
export type CloudLoggingBackendDependencies = {
	readonly onWriteError: (error: unknown) => void;
};

/** Cloud LoggingのLogSeverityです。`warn`は`WARNING`、`fatal`に相当するレベルは`CRITICAL`です。 */
type CloudLogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

const severityMap: Record<LogLevel, CloudLogSeverity> = {
	debug: 'DEBUG',
	info: 'INFO',
	warn: 'WARNING',
	error: 'ERROR',
	fatal: 'CRITICAL',
};

/** Cloud Loggingへ送る構造化ログの項目です。従来表示用の`compatibility.data`は含みません。 */
type CloudLogPayload = {
	readonly message: string;
	readonly level: LogLevel;
	readonly loggerName: string;
	readonly eventName?: string;
	readonly attributes?: LogRecord['attributes'];
	readonly error?: LogRecord['error'];
	readonly processId: number;
	readonly isPrimary: boolean;
	readonly workerId: number | null;
	readonly trace_id?: string;
	readonly span_id?: string;
	readonly trace_flags?: number;
};

const defaultDependencies: CloudLoggingBackendDependencies = {
	onWriteError: error => console.error('cloud logging backend failed to write:', error),
};

/** LogRecordからCloud Loggingへ送る項目だけを選び、秘匿前の互換データを除外します。 */
function createCloudLogPayload(record: LogRecord): CloudLogPayload {
	return {
		message: stripAnsi(record.message),
		level: record.level,
		loggerName: record.loggerName,
		...(record.eventName != null ? { eventName: record.eventName } : {}),
		...(record.attributes != null ? { attributes: record.attributes } : {}),
		...(record.error != null ? { error: record.error } : {}),
		processId: record.processId,
		isPrimary: record.isPrimary,
		workerId: record.workerId,
		...(record.traceId != null ? { trace_id: record.traceId } : {}),
		...(record.spanId != null ? { span_id: record.spanId } : {}),
		...(record.traceFlags != null ? { trace_flags: record.traceFlags } : {}),
	};
}

/**
 * 正規化済みのログをGoogle Cloud Loggingへ出力するための出力先です。
 * yojo-art 独自機能として、コンソール出力とは別にCloud Loggingへも送信します。
 * 送信の成行は保持し、終了前のflushとcloseで送信漏れと失敗の握り潰しを防ぎます。
 */
export class CloudLoggingBackend implements LogBackend {
	/** 追加登録時に二重登録を防ぐためのキーです。プロセス内で常に同じなので1つだけ登録されます。 */
	public readonly dedupeKey = 'cloudLogging';

	private readonly log: Log;
	private readonly dependencies: CloudLoggingBackendDependencies;
	private readonly pending = new Set<Promise<void>>();

	constructor(log: Log, dependencies: Partial<CloudLoggingBackendDependencies> = {}) {
		this.log = log;
		this.dependencies = {
			...defaultDependencies,
			...dependencies,
		};
	}

	public write(record: LogRecord): void {
		const payload = createCloudLogPayload(record);
		const metadata = {
			severity: severityMap[record.level],
			timestamp: new Date(record.timestamp),
			resource: {
				type: 'global',
			},
			labels: {
				name: record.loggerName,
			},
		};
		const entry = this.log.entry(metadata, payload);
		const promise = this.log.write(entry)
			.then(() => {
				this.pending.delete(promise);
			})
			.catch((error: unknown) => {
				this.pending.delete(promise);
				this.dependencies.onWriteError(error);
			});
		this.pending.add(promise);
	}

	/** 送信中のログがすべて完了するまで待ちます。失敗分も報告済みの完了として扱います。 */
	public async flush(): Promise<void> {
		while (this.pending.size > 0) {
			await Promise.allSettled([...this.pending]);
		}
	}

	/** 送信中のログを書き出してから終了します。 */
	public async close(): Promise<void> {
		await this.flush();
	}
}
