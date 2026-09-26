/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { setTimeout } from 'node:timers/promises';
import { entities } from 'misskey-js';
import {
	beforeEach,
	beforeAll,
	afterAll,
	describe,
	expect,
	test,
} from 'vitest';
import {
	api,
	captureWebhook,
	randomString,
	role,
	signup,
	startJobQueue,
	UserToken,
	WEBHOOK_HOST,
} from '../../utils.js';
import type { INestApplicationContext } from '@nestjs/common';

describe('[シナリオ] ユーザ通報', () => {
	let queue: INestApplicationContext;
	let admin: entities.SignupResponse;
	let alice: entities.SignupResponse;
	let bob: entities.SignupResponse;

	async function createSystemWebhook(args?: Partial<entities.AdminSystemWebhookCreateRequest>, credential?: UserToken): Promise<entities.AdminSystemWebhookCreateResponse> {
		const res = await api(
			'admin/system-webhook/create',
			{
				isActive: true,
				name: randomString(),
				on: ['abuseReport'],
				url: WEBHOOK_HOST,
				secret: randomString(),
				...args,
			},
			credential ?? admin,
		);
		return res.body;
	}

	async function createAbuseReportNotificationRecipient(args?: Partial<entities.AdminAbuseReportNotificationRecipientCreateRequest>, credential?: UserToken): Promise<entities.AdminAbuseReportNotificationRecipientCreateResponse> {
		const res = await api(
			'admin/abuse-report/notification-recipient/create',
			{
				isActive: true,
				name: randomString(),
				method: 'webhook',
				...args,
			},
			credential ?? admin,
		);
		return res.body;
	}

	async function createAbuseReport(args?: Partial<entities.UsersReportAbuseRequest>, credential?: UserToken): Promise<entities.EmptyResponse> {
		const res = await api(
			'users/report-abuse',
			{
				userId: alice.id,
				comment: randomString(),
				...args,
			},
			credential ?? admin,
		);
		return res.body;
	}

	// notifications の discriminated union は misskey-js の autogen 型が持つが、
	// Array.prototype.find の型ガード無しでは呼び出し側で narrowing されないため、
	// テストの見やすさのために緩く型付けした専用 helper を用意する。
	function findAbuseReportNotification(body: unknown[], reportId: string) {
		return body.find(n => (n as { type?: string }).type === 'abuseReport' && (n as { reportId?: string }).reportId === reportId) as {
			targetUserId: string;
			userId: string;
			resolved: boolean;
			resolvedAs: string | null;
			assigneeId: string | null;
		} | undefined;
	}

	// in-app 通知は NotificationService.createNotification が非同期 (fire-and-forget) で
	// 作成するため、固定時間 sleep ではなく出現 (present=false なら消滅) するまで polling する。
	async function waitForAbuseReportNotification(user: UserToken, reportId: string, present = true) {
		for (let i = 0; i < 50; i++) {
			const res = await api('i/notifications', {}, user);
			if (res.status !== 200) throw new Error(`i/notifications failed: ${res.status}`);
			const notification = findAbuseReportNotification(res.body, reportId);
			if ((notification != null) === present) return notification;
			await setTimeout(100);
		}
		throw new Error(`abuseReport notification ${present ? 'not found' : 'still exists'}`);
	}

	async function resolveAbuseReport(args?: Partial<entities.AdminResolveAbuseUserReportRequest>, credential?: UserToken): Promise<entities.EmptyResponse> {
		const res = await api(
			'admin/resolve-abuse-user-report',
			{
				reportId: admin.id,
				...args,
			},
			credential ?? admin,
		);
		return res.body;
	}

	// -------------------------------------------------------------------------------------------

	beforeAll(async () => {
		queue = await startJobQueue();
		admin = await signup({ username: 'admin' });
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });

		const adminRole = await role(admin, { isAdministrator: true });
		await api('admin/roles/assign', { userId: admin.id, roleId: adminRole.id }, admin);
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await queue.close();
	});

	// -------------------------------------------------------------------------------------------

	describe('SystemWebhook', () => {
		beforeEach(async () => {
			const webhooks = await api('admin/system-webhook/list', {}, admin);
			for (const webhook of webhooks.body) {
				await api('admin/system-webhook/delete', { id: webhook.id }, admin);
			}
		});

		test('通報を受けた -> abuseReportが送出される', async () => {
			const webhook = await createSystemWebhook({
				on: ['abuseReport'],
				isActive: true,
			});
			await createAbuseReportNotificationRecipient({ systemWebhookId: webhook.id });

			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			const webhookBody = await captureWebhook(async () => {
				await createAbuseReport(abuse, bob);
			});

			console.log(JSON.stringify(webhookBody, null, 2));

			expect(webhookBody.hookId).toBe(webhook.id);
			expect(webhookBody.type).toBe('abuseReport');
			expect(webhookBody.body.targetUserId).toBe(alice.id);
			expect(webhookBody.body.reporterId).toBe(bob.id);
			expect(webhookBody.body.comment).toBe(abuse.comment);
		});

		test('通報を受けた -> abuseReportが送出される -> 解決 -> abuseReportResolvedが送出される', async () => {
			const webhook = await createSystemWebhook({
				on: ['abuseReport', 'abuseReportResolved'],
				isActive: true,
			});
			await createAbuseReportNotificationRecipient({ systemWebhookId: webhook.id });

			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			const webhookBody1 = await captureWebhook(async () => {
				await createAbuseReport(abuse, bob);
			});

			console.log(JSON.stringify(webhookBody1, null, 2));
			expect(webhookBody1.hookId).toBe(webhook.id);
			expect(webhookBody1.type).toBe('abuseReport');
			expect(webhookBody1.body.targetUserId).toBe(alice.id);
			expect(webhookBody1.body.reporterId).toBe(bob.id);
			expect(webhookBody1.body.assigneeId).toBeNull();
			expect(webhookBody1.body.resolved).toBe(false);
			expect(webhookBody1.body.comment).toBe(abuse.comment);

			// 解決
			const webhookBody2 = await captureWebhook(async () => {
				await resolveAbuseReport({
					reportId: webhookBody1.body.id,
				}, admin);
			});

			console.log(JSON.stringify(webhookBody2, null, 2));
			expect(webhookBody2.hookId).toBe(webhook.id);
			expect(webhookBody2.type).toBe('abuseReportResolved');
			expect(webhookBody2.body.targetUserId).toBe(alice.id);
			expect(webhookBody2.body.reporterId).toBe(bob.id);
			expect(webhookBody2.body.assigneeId).toBe(admin.id);
			expect(webhookBody2.body.resolved).toBe(true);
			expect(webhookBody2.body.comment).toBe(abuse.comment);
		});

		test('通報を受けた -> abuseReportが未許可の場合は送出されない', async () => {
			const webhook = await createSystemWebhook({
				on: [],
				isActive: true,
			});
			await createAbuseReportNotificationRecipient({ systemWebhookId: webhook.id });

			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			const webhookBody = await captureWebhook(async () => {
				await createAbuseReport(abuse, bob);
			}).catch(e => e.message);

			expect(webhookBody).toBe('timeout');
		});

		test('通報を受けた -> abuseReportが未許可の場合は送出されない -> 解決 -> abuseReportResolvedが送出される', async () => {
			const webhook = await createSystemWebhook({
				on: ['abuseReportResolved'],
				isActive: true,
			});
			await createAbuseReportNotificationRecipient({ systemWebhookId: webhook.id });

			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			const webhookBody1 = await captureWebhook(async () => {
				await createAbuseReport(abuse, bob);
			}).catch(e => e.message);

			expect(webhookBody1).toBe('timeout');

			const abuseReportId = (await api('admin/abuse-user-reports', {}, admin)).body[0].id;

			// 解決
			const webhookBody2 = await captureWebhook(async () => {
				await resolveAbuseReport({
					reportId: abuseReportId,
				}, admin);
			});

			console.log(JSON.stringify(webhookBody2, null, 2));
			expect(webhookBody2.hookId).toBe(webhook.id);
			expect(webhookBody2.type).toBe('abuseReportResolved');
			expect(webhookBody2.body.targetUserId).toBe(alice.id);
			expect(webhookBody2.body.reporterId).toBe(bob.id);
			expect(webhookBody2.body.assigneeId).toBe(admin.id);
			expect(webhookBody2.body.resolved).toBe(true);
			expect(webhookBody2.body.comment).toBe(abuse.comment);
		});

		test('通報を受けた -> abuseReportが送出される -> 解決 -> abuseReportResolvedが未許可の場合は送出されない', async () => {
			const webhook = await createSystemWebhook({
				on: ['abuseReport'],
				isActive: true,
			});
			await createAbuseReportNotificationRecipient({ systemWebhookId: webhook.id });

			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			const webhookBody1 = await captureWebhook(async () => {
				await createAbuseReport(abuse, bob);
			});

			console.log(JSON.stringify(webhookBody1, null, 2));
			expect(webhookBody1.hookId).toBe(webhook.id);
			expect(webhookBody1.type).toBe('abuseReport');
			expect(webhookBody1.body.targetUserId).toBe(alice.id);
			expect(webhookBody1.body.reporterId).toBe(bob.id);
			expect(webhookBody1.body.assigneeId).toBeNull();
			expect(webhookBody1.body.resolved).toBe(false);
			expect(webhookBody1.body.comment).toBe(abuse.comment);

			// 解決
			const webhookBody2 = await captureWebhook(async () => {
				await resolveAbuseReport({
					reportId: webhookBody1.body.id,
				}, admin);
			}).catch(e => e.message);

			expect(webhookBody2).toBe('timeout');
		});

		test('通報を受けた -> abuseReportが未許可の場合は送出されない -> 解決 -> abuseReportResolvedが未許可の場合は送出されない', async () => {
			const webhook = await createSystemWebhook({
				on: [],
				isActive: true,
			});
			await createAbuseReportNotificationRecipient({ systemWebhookId: webhook.id });

			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			const webhookBody1 = await captureWebhook(async () => {
				await createAbuseReport(abuse, bob);
			}).catch(e => e.message);

			expect(webhookBody1).toBe('timeout');

			const abuseReportId = (await api('admin/abuse-user-reports', {}, admin)).body[0].id;

			// 解決
			const webhookBody2 = await captureWebhook(async () => {
				await resolveAbuseReport({
					reportId: abuseReportId,
				}, admin);
			}).catch(e => e.message);

			expect(webhookBody2).toBe('timeout');
		});

		test('通報を受けた -> Webhookが無効の場合は送出されない', async () => {
			const webhook = await createSystemWebhook({
				on: ['abuseReport', 'abuseReportResolved'],
				isActive: false,
			});
			await createAbuseReportNotificationRecipient({ systemWebhookId: webhook.id });

			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			const webhookBody1 = await captureWebhook(async () => {
				await createAbuseReport(abuse, bob);
			}).catch(e => e.message);

			expect(webhookBody1).toBe('timeout');

			const abuseReportId = (await api('admin/abuse-user-reports', {}, admin)).body[0].id;

			// 解決
			const webhookBody2 = await captureWebhook(async () => {
				await resolveAbuseReport({
					reportId: abuseReportId,
				}, admin);
			}).catch(e => e.message);

			expect(webhookBody2).toBe('timeout');
		});

		test('通報を受けた -> 通知設定が無効の場合は送出されない', async () => {
			const webhook = await createSystemWebhook({
				on: ['abuseReport', 'abuseReportResolved'],
				isActive: true,
			});
			await createAbuseReportNotificationRecipient({ systemWebhookId: webhook.id, isActive: false });

			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			const webhookBody1 = await captureWebhook(async () => {
				await createAbuseReport(abuse, bob);
			}).catch(e => e.message);

			expect(webhookBody1).toBe('timeout');

			const abuseReportId = (await api('admin/abuse-user-reports', {}, admin)).body[0].id;

			// 解決
			const webhookBody2 = await captureWebhook(async () => {
				await resolveAbuseReport({
					reportId: abuseReportId,
				}, admin);
			}).catch(e => e.message);

			expect(webhookBody2).toBe('timeout');
		});
	});

	describe('InAppNotification', () => {
		test('通報を受けた -> モデレーターの通知欄にabuseReport通知が作成される(コメントは含まれない)', async () => {
			// 通報(bob -> alice)
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			await createAbuseReport(abuse, bob);

			const abuseReportId = (await api('admin/abuse-user-reports', {}, admin)).body[0].id;

			const abuseNotif = await waitForAbuseReportNotification(admin, abuseReportId);

			if (abuseNotif == null) {
				throw new Error('abuseReport notification not found');
			}
			expect(abuseNotif.targetUserId).toBe(alice.id);
			expect(abuseNotif.userId).toBe(bob.id);
			expect(abuseNotif.resolved).toBe(false);
			expect(abuseNotif.resolvedAs).toBeNull();
			expect(abuseNotif.assigneeId).toBeNull();
			expect(abuseNotif).not.toHaveProperty('comment');
		});

		test('通報を解決すると、既存の通知のresolvedが更新される(read時に都度解決される)', async () => {
			const abuse = {
				userId: alice.id,
				comment: randomString(),
			};
			await createAbuseReport(abuse, bob);

			const abuseReportId = (await api('admin/abuse-user-reports', {}, admin)).body[0].id;
			await waitForAbuseReportNotification(admin, abuseReportId);

			await resolveAbuseReport({ reportId: abuseReportId }, admin);

			const abuseNotif = await waitForAbuseReportNotification(admin, abuseReportId);

			if (abuseNotif == null) {
				throw new Error('abuseReport notification not found');
			}
			expect(abuseNotif.resolved).toBe(true);
			expect(abuseNotif.assigneeId).toBe(admin.id);
		});

		test('モデレーターでなくなったユーザには既存のabuseReport通知が返されない', async () => {
			const carol = await signup({ username: 'carol' });
			const moderatorRole = await role(admin, { isModerator: true });
			await api('admin/roles/assign', { userId: carol.id, roleId: moderatorRole.id }, admin);

			await createAbuseReport({ userId: alice.id, comment: randomString() }, bob);

			const abuseReportId = (await api('admin/abuse-user-reports', {}, admin)).body[0].id;

			await waitForAbuseReportNotification(carol, abuseReportId);

			await api('admin/roles/unassign', { userId: carol.id, roleId: moderatorRole.id }, admin);

			await waitForAbuseReportNotification(carol, abuseReportId, false);
		});
	});
});
