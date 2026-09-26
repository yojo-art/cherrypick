/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'node:assert';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { Redis } from 'ioredis';
import { api, randomString, role, signup } from '../utils.js';
import type * as misskey from 'misskey-js';
import { loadConfig } from '@/config.js';

describe('通報インジケーター (hasUnreadAbuseReport)', () => {
	let redisClient: Redis;

	let root: misskey.entities.SignupResponse;
	let modA: misskey.entities.SignupResponse;
	let modB: misskey.entities.SignupResponse;
	let reporter: misskey.entities.SignupResponse;
	let target: misskey.entities.SignupResponse;

	async function report(from: misskey.entities.SignupResponse, to: misskey.entities.SignupResponse = target): Promise<string> {
		const res = await api('users/report-abuse', { userId: to.id, comment: randomString() }, from);
		assert.strictEqual(res.status, 204);

		const reports = await api('admin/abuse-user-reports', { state: 'unresolved', limit: 1 }, root);
		return reports.body[0].id;
	}

	async function hasUnread(user: misskey.entities.SignupResponse): Promise<boolean> {
		const res = await api('i', {}, user);
		assert.strictEqual(res.status, 200);
		return res.body.hasUnreadAbuseReport;
	}

	beforeAll(async () => {
		redisClient = new Redis(loadConfig().redis);

		// 最初に登録したユーザがrootになる
		root = await signup({ username: 'indicatorRoot' });
		modA = await signup({ username: 'indicatorModA' });
		modB = await signup({ username: 'indicatorModB' });
		reporter = await signup({ username: 'indicatorReporter' });
		target = await signup({ username: 'indicatorTarget' });

		const moderatorRole = await role(root, { isModerator: true, name: 'Moderator Role (abuse-report-indicator)' });
		await api('admin/roles/assign', { userId: modA.id, roleId: moderatorRole.id }, root);
		await api('admin/roles/assign', { userId: modB.id, roleId: moderatorRole.id }, root);
	}, 1000 * 60 * 2);

	afterAll(async () => {
		redisClient.disconnect();
	});

	beforeEach(async () => {
		// 前のテストの未解決通報と Redis の状態を持ち越さない
		const reports = await api('admin/abuse-user-reports', { state: 'unresolved', limit: 100 }, root);
		for (const r of reports.body) {
			await api('admin/resolve-abuse-user-report', { reportId: r.id }, root);
		}
		for (const user of [root, modA, modB, reporter, target]) {
			await redisClient.del(`unreadAbuseReport:${user.id}`, `readAbuseReport:${user.id}`);
		}
		await api('i/update', { receiveAbuseReportIndicator: true }, modA);
	});

	test('通報があると全モデレーターの未読Setに入り、点灯する', async () => {
		const reportId = await report(reporter);

		for (const moderator of [root, modA, modB]) {
			assert.ok(await redisClient.sismember(`unreadAbuseReport:${moderator.id}`, reportId));
			assert.strictEqual(await hasUnread(moderator), true);
		}
	});

	test('既読にすると本人だけ消灯し、新しい通報で再点灯する', async () => {
		await report(reporter);

		const res = await api('admin/abuse-report/mark-as-read', {}, modA);
		assert.strictEqual(res.status, 204);

		assert.strictEqual(await redisClient.exists(`unreadAbuseReport:${modA.id}`), 0);
		assert.strictEqual(await redisClient.exists(`readAbuseReport:${modA.id}`), 1);
		assert.strictEqual(await hasUnread(modA), false);
		assert.strictEqual(await hasUnread(modB), true);

		await report(reporter);
		assert.strictEqual(await hasUnread(modA), true);
	});

	test('他のモデレーターが解決すると、未確認のモデレーターも消灯する', async () => {
		const reportId = await report(reporter);
		assert.strictEqual(await hasUnread(modA), true);

		await api('admin/resolve-abuse-user-report', { reportId }, modB);

		assert.strictEqual(await redisClient.sismember(`unreadAbuseReport:${modA.id}`, reportId), 0);
		assert.strictEqual(await hasUnread(modA), false);
		assert.strictEqual(await hasUnread(modB), false);
	});

	test('インジケーターを無効にしたモデレーターは点灯しない', async () => {
		await api('i/update', { receiveAbuseReportIndicator: false }, modA);
		await report(reporter);

		const i = await api('i', {}, modA);
		assert.strictEqual(i.body.receiveAbuseReportIndicator, false);
		assert.strictEqual(i.body.hasUnreadAbuseReport, false);

		// 無効中の通報も未読 Set には記録され、有効化すると点灯する
		await api('i/update', { receiveAbuseReportIndicator: true }, modA);
		assert.strictEqual(await hasUnread(modA), true);
	});

	test('モデレーターでないユーザは点灯せず、既読化もできない', async () => {
		await report(reporter);

		assert.strictEqual(await redisClient.exists(`unreadAbuseReport:${reporter.id}`), 0);
		assert.strictEqual(await hasUnread(reporter), false);

		const res = await api('admin/abuse-report/mark-as-read', {}, reporter);
		assert.notStrictEqual(res.status, 204);
	});

	test('通報したモデレーター本人は点灯しない', async () => {
		const reportId = await report(modA);

		assert.strictEqual(await redisClient.exists(`unreadAbuseReport:${modA.id}`), 0);
		assert.strictEqual(await hasUnread(modA), false);
		assert.ok(await redisClient.sismember(`unreadAbuseReport:${modB.id}`, reportId));
	});

	test('Redis キーが消失していても DB に未解決の通報があれば点灯する (fail-closed)', async () => {
		await report(reporter);

		await redisClient.del(`unreadAbuseReport:${modA.id}`, `readAbuseReport:${modA.id}`);
		assert.strictEqual(await hasUnread(modA), true);

		// 既読マーカーがあれば DB に未解決の通報があっても点灯しない
		await api('admin/abuse-report/mark-as-read', {}, modA);
		assert.strictEqual(await hasUnread(modA), false);
	});
});
