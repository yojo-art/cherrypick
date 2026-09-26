/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import type { Log } from '@google-cloud/logging';
import type { LogLevel, LogRecord } from '@/logging/types.js';
import { CloudLoggingBackend } from '@/logging/CloudLoggingBackend.js';

/** テストで使う共通のログを作成します。 */
function createRecord(overrides: Partial<LogRecord> = {}): LogRecord {
	return {
		level: 'info',
		message: 'note created',
		context: [{ name: 'core' }, { name: 'note' }],
		timestamp: '2025-01-02T03:04:05.678Z',
		loggerName: 'core.note',
		processId: 1234,
		isPrimary: true,
		workerId: null,
		...overrides,
	};
}

/** Log.writeの結果を制御するためのstubを作成します。 */
function createLogStub(writeImpl?: () => Promise<void>) {
	const entry = vi.fn<(metadata: object, data: object) => { metadata: object; data: object }>();
	const write = vi.fn<() => Promise<void>>(writeImpl ?? (async () => {}));
	return {
		entry,
		write,
		log: { entry, write } as unknown as Log,
	};
}

describe('CloudLoggingBackend', () => {
	test('maps each level to the Cloud Logging severity, including fatal to CRITICAL', () => {
		const stub = createLogStub();
		const backend = new CloudLoggingBackend(stub.log);
		const expected: Record<LogLevel, string> = {
			debug: 'DEBUG',
			info: 'INFO',
			warn: 'WARNING',
			error: 'ERROR',
			fatal: 'CRITICAL',
		};

		for (const level of Object.keys(expected) as LogLevel[]) {
			backend.write(createRecord({ level }));
		}

		expect(stub.entry.mock.calls.map(call => (call[0] as { severity: string }).severity))
			.toEqual(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']);
		expect(stub.write).toHaveBeenCalledTimes(5);
	});

	test('sends structured fields without the legacy compatibility data', async () => {
		const stub = createLogStub();
		const backend = new CloudLoggingBackend(stub.log);

		backend.write(createRecord({
			level: 'warn',
			message: '\u001b[38;5;208mcolored message\u001b[39m',
			eventName: 'note.created',
			attributes: { noteId: '123' },
			error: { type: 'Error', message: 'broken', stack: 'stack' },
			traceId: 'trace',
			spanId: 'span',
			traceFlags: 1,
			compatibility: { data: { secretToken: 'raw-legacy-value' } },
		}));
		await backend.flush();

		const [metadata, data] = stub.entry.mock.calls[0] as [{ severity: string }, Record<string, unknown>];
		expect(metadata.severity).toBe('WARNING');
		expect(data).toEqual({
			message: 'colored message',
			level: 'warn',
			loggerName: 'core.note',
			eventName: 'note.created',
			attributes: { noteId: '123' },
			error: { type: 'Error', message: 'broken', stack: 'stack' },
			processId: 1234,
			isPrimary: true,
			workerId: null,
			trace_id: 'trace',
			span_id: 'span',
			trace_flags: 1,
		});
		expect(JSON.stringify(data)).not.toContain('raw-legacy-value');
	});

	test('reports write failures instead of swallowing them', async () => {
		const failure = new Error('transport closed');
		const stub = createLogStub(() => Promise.reject(failure));
		const onWriteError = vi.fn<(error: unknown) => void>();
		const backend = new CloudLoggingBackend(stub.log, { onWriteError });

		backend.write(createRecord());
		await backend.flush();

		expect(onWriteError).toHaveBeenCalledOnce();
		expect(onWriteError.mock.calls[0][0]).toBe(failure);
	});

	test('flush waits until pending writes settle', async () => {
		let resolveWrite: () => void = () => {};
		const stub = createLogStub(() => new Promise<void>(resolve => { resolveWrite = resolve; }));
		const backend = new CloudLoggingBackend(stub.log);

		backend.write(createRecord());
		let flushed = false;
		const pending = backend.flush().then(() => { flushed = true; });

		await Promise.resolve();
		expect(flushed).toBe(false);

		resolveWrite();
		await pending;
		expect(stub.write).toHaveBeenCalledOnce();
	});

	test('close flushes pending writes', async () => {
		let resolveWrite: () => void = () => {};
		const stub = createLogStub(() => new Promise<void>(resolve => { resolveWrite = resolve; }));
		const backend = new CloudLoggingBackend(stub.log);

		backend.write(createRecord());
		let closed = false;
		const closing = backend.close().then(() => { closed = true; });

		await Promise.resolve();
		expect(closed).toBe(false);

		resolveWrite();
		await closing;
		expect(stub.write).toHaveBeenCalledOnce();
	});
});
