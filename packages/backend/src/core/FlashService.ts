/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import got, * as Got from 'got';
import * as Redis from 'ioredis';
import type { Config } from '@/config.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DI } from '@/di-symbols.js';
import type { ClipsRepository, ClipNotesRepository, NotesRepository, MiUser, FlashsRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { Packed } from '@/misc/json-schema.js';
import { emojis } from '@/misc/remote-api-utils.js';

@Injectable()
export class FlashService {
	public static FailedToResolveRemoteUserError = class extends Error {};

	constructor(
		@Inject(DI.config)
		private config: Config,
		@Inject(DI.redisForRemoteApis)
		private redisForRemoteApis: Redis.Redis,
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		@Inject(DI.clipNotesRepository)
		private clipNotesRepository: ClipNotesRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.flashsRepository)
		private flashRepository: FlashsRepository,

		private httpRequestService: HttpRequestService,
		private userEntityService: UserEntityService,
		private remoteUserResolveService: RemoteUserResolveService,
		private roleService: RoleService,
		private idService: IdService,
	) {
	}
	/**
	 * 人気のあるPlay一覧を取得する.
	 */
	public async featured(opts?: { offset?: number, limit: number }) {
		const builder = this.flashRepository.createQueryBuilder('flash')
			.andWhere('flash.likedCount > 0')
			.andWhere('flash.visibility = :visibility', { visibility: 'public' })
			.addOrderBy('flash.likedCount', 'DESC')
			.addOrderBy('flash.updatedAt', 'DESC')
			.addOrderBy('flash.id', 'DESC');

		if (opts?.offset) {
			builder.skip(opts.offset);
		}

		builder.take(opts?.limit ?? 10);

		return await builder.getMany();
	}
	@bindThis
	async showRemoteOrDummy(
		flashId: string,
		author: MiUser | null,
		fetch_emoji = false,
	) : Promise<Packed<'Flash'>> {
		if (author == null) {
			throw new Error();
		}
		try {
			if (author.host == null) {
				throw new Error();
			}
			return await this.showRemote(flashId, author.host, fetch_emoji);
		} catch {
			return await awaitAll({
				id: flashId + '@' + (author.host ? author.host : ''),
				createdAt: new Date(0).toISOString(),
				updatedAt: new Date(0).toISOString(),
				userId: author.id,
				user: this.userEntityService.pack(author),
				title: 'Unavailable',
				summary: '',
				script: '',
				favoritedCount: 0,
				visibility: 'public',
				likedCount: 0,
				isLiked: false, //後でLike対応する
			});
		}
	}
	@bindThis
	public async showRemote(
		flashId:string,
		host:string,
		fetch_emoji = false,
	) : Promise<Packed<'Flash'>> {
		const cache_key = 'flash:show:' + flashId + '@' + host;
		const cache_value = await this.redisForRemoteApis.get(cache_key);
		let remote_json = null;
		if (cache_value === null) {
			const timeout = 30 * 1000;
			const operationTimeout = 60 * 1000;
			const url = 'https://' + host + '/api/flash/show';
			const res = got.post(url, {
				headers: {
					'User-Agent': this.config.userAgent,
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
					http: this.httpRequestService.httpAgent,
					https: this.httpRequestService.httpsAgent,
				},
				http2: true,
				retry: {
					limit: 1,
				},
				enableUnixSockets: false,
				body: JSON.stringify({
					flashId,
				}),
			});
			remote_json = await res.text();
			const redisPipeline = this.redisForRemoteApis.pipeline();
			redisPipeline.set(cache_key, remote_json);
			redisPipeline.expire(cache_key, 10 * 60);
			await redisPipeline.exec();
		} else {
			remote_json = cache_value;
		}
		const remote = JSON.parse(remote_json);
		if (remote.user == null || remote.user.username == null) {
			throw new FlashService.FailedToResolveRemoteUserError();
		}
		const user = await this.remoteUserResolveService.resolveUser(remote.user.username, host).catch(err => {
			throw new FlashService.FailedToResolveRemoteUserError();
		});
		return await awaitAll({
			id: flashId + '@' + host,
			createdAt: remote.createdAt ? new Date(remote.createdAt).toISOString() : new Date(0).toISOString(),
			updatedAt: remote.updatedAt ? new Date(remote.updatedAt).toISOString() : new Date(0).toISOString(),
			userId: user.id,
			user: this.userEntityService.pack(user),
			title: String(remote.title),
			summary: String(remote.summary),
			script: String(remote.script),
			favoritedCount: remote.favoritedCount,
			visibility: remote.visibility ?? 'public',
			likedCount: remote.likedCount ?? 0,
			isLiked: false, //後でLike対応する
			emojis: (remote.summary && fetch_emoji) ? emojis(this.config, this.httpRequestService, this.redisForRemoteApis, host, remote.summary) : {},
		});
	}
}
