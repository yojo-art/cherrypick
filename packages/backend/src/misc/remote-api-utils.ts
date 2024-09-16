/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Redis from 'ioredis';
import got, * as Got from 'got';
import type { Config } from '@/config.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { MiUser } from '@/models/User.js';

export type FetchRemoteApiOpts={
	/** リモートで割り当てられているid */
	userId?:string,
	limit?:number,
	sinceId?:string,
	untilId?:string,
};

export async function fetch_remote_api(
	config: Config, httpRequestService: HttpRequestService, host: string, endpoint: string, opts: FetchRemoteApiOpts,
) {
	const url = 'https://' + host + endpoint;
	const sinceIdRemote = opts.sinceId ? opts.sinceId.split('@')[0] : undefined;
	const untilIdRemote = opts.untilId ? opts.untilId.split('@')[0] : undefined;
	const timeout = 30 * 1000;
	const operationTimeout = 60 * 1000;
	const res = got.post(url, {
		headers: {
			'User-Agent': config.userAgent,
			'Content-Type': 'application/json; charset=utf-8',
		},
		timeout: {
			lookup: timeout,
			connect: timeout,
			secureConnect: timeout,
			socket: timeout,	// read timeout
			response: timeout,
			send: timeout,
			request: operationTimeout,	// whole operation timeout
		},
		agent: {
			http: httpRequestService.httpAgent,
			https: httpRequestService.httpsAgent,
		},
		http2: true,
		retry: {
			limit: 1,
		},
		enableUnixSockets: false,
		body: JSON.stringify({
			userId: opts.userId,
			limit: opts.limit,
			sinceId: sinceIdRemote,
			untilId: untilIdRemote,
		}),
	});
	return await res.text();
}
/** userがリモートで割り当てられているidを取得 */
export async function fetch_remote_user_id(
	config:Config,
	httpRequestService: HttpRequestService,
	redisForRemoteApis: Redis.Redis,
	user:MiUser,
) {
	//ローカルのIDからリモートのIDを割り出す
	const cache_key = 'remote-userId:' + user.id;
	const id = await redisForRemoteApis.get(cache_key);
	if (id !== null) {
		if (id === '__NOT_MISSKEY') {
			return null;
		}
		if (id === '__INTERVAL') {
			return null;
		}
		//アクセス時に有効期限を更新
		redisForRemoteApis.expire(cache_key, 7 * 24 * 60 * 60);
		return id;
	}
	try {
		const url = 'https://' + user.host + '/api/users/show';
		const timeout = 30 * 1000;
		const operationTimeout = 60 * 1000;
		const res = got.post(url, {
			headers: {
				'User-Agent': config.userAgent,
				'Content-Type': 'application/json; charset=utf-8',
			},
			timeout: {
				lookup: timeout,
				connect: timeout,
				secureConnect: timeout,
				socket: timeout,	// read timeout
				response: timeout,
				send: timeout,
				request: operationTimeout,	// whole operation timeout
			},
			agent: {
				http: httpRequestService.httpAgent,
				https: httpRequestService.httpsAgent,
			},
			http2: true,
			retry: {
				limit: 1,
			},
			enableUnixSockets: false,
			body: JSON.stringify({
				username: user.username,
			}),
		});
		const text = await res.text();
		const json = JSON.parse(text);
		if (json.id != null) {
			const redisPipeline = redisForRemoteApis.pipeline();
			redisPipeline.set(cache_key, json.id);
			//キャッシュ期限1週間
			redisPipeline.expire(cache_key, 7 * 24 * 60 * 60);
			await redisPipeline.exec();
			return json.id as string;
		}
	} catch {
		const redisPipeline = redisForRemoteApis.pipeline();
		redisPipeline.set(cache_key, '__INTERVAL');
		redisPipeline.expire(cache_key, 60 * 60);
		await redisPipeline.exec();
	}
	return null;
}
