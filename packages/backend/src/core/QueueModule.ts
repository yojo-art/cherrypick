/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import * as Bull from 'bullmq';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { baseQueueOptions, QUEUE } from '@/queue/const.js';
import { allSettled } from '@/misc/promise-tracker.js';
import {
	DeliverJobData,
	EndedPollNotificationJobData,
	InboxJobData,
	RelationshipJobData,
	UserWebhookDeliverJobData,
	SystemWebhookDeliverJobData,
	ScheduledNoteDeleteJobData,
	ScheduleNotePostJobData,
} from '../queue/types.js';
import type { Provider } from '@nestjs/common';

export type SystemQueue = Bull.Queue<Record<string, unknown>>;
export type EndedPollNotificationQueue = Bull.Queue<EndedPollNotificationJobData>;
export type DeliverQueue = Bull.Queue<DeliverJobData>;
export type InboxQueue = Bull.Queue<InboxJobData>;
export type DbQueue = Bull.Queue;
export type RelationshipQueue = Bull.Queue<RelationshipJobData>;
export type ObjectStorageQueue = Bull.Queue;
export type UserWebhookDeliverQueue = Bull.Queue<UserWebhookDeliverJobData>;
export type SystemWebhookDeliverQueue = Bull.Queue<SystemWebhookDeliverJobData>;
export type ScheduledNoteDeleteQueue = Bull.Queue<ScheduledNoteDeleteJobData>;
export type ScheduleNotePostQueue = Bull.Queue<ScheduleNotePostJobData>;

const $system: Provider = {
	provide: 'queue:system',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.SYSTEM, baseQueueOptions(config, QUEUE.SYSTEM, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $endedPollNotification: Provider = {
	provide: 'queue:endedPollNotification',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.ENDED_POLL_NOTIFICATION, baseQueueOptions(config, QUEUE.ENDED_POLL_NOTIFICATION, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $deliver: Provider = {
	provide: 'queue:deliver',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.DELIVER, baseQueueOptions(config, QUEUE.DELIVER, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $inbox: Provider = {
	provide: 'queue:inbox',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.INBOX, baseQueueOptions(config, QUEUE.INBOX, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $db: Provider = {
	provide: 'queue:db',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.DB, baseQueueOptions(config, QUEUE.DB, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $relationship: Provider = {
	provide: 'queue:relationship',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.RELATIONSHIP, baseQueueOptions(config, QUEUE.RELATIONSHIP, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $objectStorage: Provider = {
	provide: 'queue:objectStorage',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.OBJECT_STORAGE, baseQueueOptions(config, QUEUE.OBJECT_STORAGE, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $userWebhookDeliver: Provider = {
	provide: 'queue:userWebhookDeliver',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.USER_WEBHOOK_DELIVER, baseQueueOptions(config, QUEUE.USER_WEBHOOK_DELIVER, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $systemWebhookDeliver: Provider = {
	provide: 'queue:systemWebhookDeliver',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.SYSTEM_WEBHOOK_DELIVER, baseQueueOptions(config, QUEUE.SYSTEM_WEBHOOK_DELIVER, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $scheduledNoteDelete: Provider = {
	provide: 'queue:scheduledNoteDelete',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.SCHEDULED_NOTE_DELETE, baseQueueOptions(config, QUEUE.SCHEDULED_NOTE_DELETE, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

const $scheduleNotePost: Provider = {
	provide: 'queue:scheduleNotePost',
	useFactory: (config: Config, redisForJobQueue: Redis.Redis) => new Bull.Queue(QUEUE.SCHEDULE_NOTE_POST, baseQueueOptions(config, QUEUE.SCHEDULE_NOTE_POST, redisForJobQueue)),
	inject: [DI.config, DI.redisForJobQueue],
};

@Module({
	imports: [
	],
	providers: [
		$system,
		$endedPollNotification,
		$deliver,
		$inbox,
		$db,
		$relationship,
		$objectStorage,
		$userWebhookDeliver,
		$systemWebhookDeliver,
		$scheduledNoteDelete,
		$scheduleNotePost,
	],
	exports: [
		$system,
		$endedPollNotification,
		$deliver,
		$inbox,
		$db,
		$relationship,
		$objectStorage,
		$userWebhookDeliver,
		$systemWebhookDeliver,
		$scheduledNoteDelete,
		$scheduleNotePost,
	],
})
export class QueueModule implements OnApplicationShutdown {
	constructor(
		@Inject('queue:system') public systemQueue: SystemQueue,
		@Inject('queue:endedPollNotification') public endedPollNotificationQueue: EndedPollNotificationQueue,
		@Inject('queue:deliver') public deliverQueue: DeliverQueue,
		@Inject('queue:inbox') public inboxQueue: InboxQueue,
		@Inject('queue:db') public dbQueue: DbQueue,
		@Inject('queue:relationship') public relationshipQueue: RelationshipQueue,
		@Inject('queue:objectStorage') public objectStorageQueue: ObjectStorageQueue,
		@Inject('queue:userWebhookDeliver') public userWebhookDeliverQueue: UserWebhookDeliverQueue,
		@Inject('queue:systemWebhookDeliver') public systemWebhookDeliverQueue: SystemWebhookDeliverQueue,
		@Inject('queue:scheduledNoteDelete') public scheduledNoteDeleteQueue: ScheduledNoteDeleteQueue,
		@Inject('queue:scheduleNotePost') public scheduleNotePostQueue: ScheduleNotePostQueue,
	) {}

	public async dispose(): Promise<void> {
		// Wait for all potential queue jobs
		await allSettled();
		// And then close all queues
		await Promise.all([
			this.systemQueue.close(),
			this.endedPollNotificationQueue.close(),
			this.deliverQueue.close(),
			this.inboxQueue.close(),
			this.dbQueue.close(),
			this.relationshipQueue.close(),
			this.objectStorageQueue.close(),
			this.userWebhookDeliverQueue.close(),
			this.systemWebhookDeliverQueue.close(),
			this.scheduledNoteDeleteQueue.close(),
			this.scheduleNotePostQueue.close(),
		]);
	}

	async onApplicationShutdown(signal: string): Promise<void> {
		await this.dispose();
	}
}
