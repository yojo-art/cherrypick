/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { AnnouncementReactionsRepository, EmojisRepository, MiAnnouncement, MiAnnouncementReaction, MiUser } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { ReactionService } from '@/core/ReactionService.js';
import { RoleService } from '@/core/RoleService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { bindThis } from '@/decorators.js';

const FALLBACK = '\u2764';

const isCustomEmojiRegexp = /^:([\w+-]+)(?:@\.)?:$/;

@Injectable()
export class AnnouncementReactionService {
	constructor(
		@Inject(DI.announcementReactionsRepository)
		private announcementReactionsRepository: AnnouncementReactionsRepository,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private idService: IdService,
		private customEmojiService: CustomEmojiService,
		private reactionService: ReactionService,
		private roleService: RoleService,
		private utilityService: UtilityService,
		private globalEventService: GlobalEventService,
	) {
	}

	/**
	 * リアクション文字列を検証して正規化する。
	 * カスタム絵文字はローカルに存在し、かつ使用権限があるものだけを受け付ける。
	 */
	@bindThis
	private async normalizeReaction(user: { id: MiUser['id']; host?: MiUser['host'] }, reaction: string | null | undefined): Promise<string> {
		if (reaction == null) return FALLBACK;

		const custom = reaction.match(isCustomEmojiRegexp);
		if (custom == null) {
			return this.reactionService.normalize(reaction);
		}

		// お知らせはローカル専用のため、リモートのカスタム絵文字は受け付けない
		if (this.utilityService.toPunyNullable(user.host ?? null) != null) {
			return FALLBACK;
		}

		const name = custom[1];
		const emoji = (await this.customEmojiService.localEmojisCache.fetch()).get(name);
		if (emoji == null) return FALLBACK;

		const allowed = emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.length === 0 ||
			(await this.roleService.getUserRoles(user.id)).some(r => emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.includes(r.id));

		if (!allowed) return FALLBACK;

		return `:${name}:`;
	}

	@bindThis
	public async create(user: { id: MiUser['id']; host: MiUser['host'] }, announcement: MiAnnouncement, _reaction?: string | null): Promise<void> {
		const reaction = await this.normalizeReaction(user, _reaction);

		const record: MiAnnouncementReaction = {
			id: this.idService.gen(),
			announcementId: announcement.id,
			userId: user.id,
			reaction,
		};

		try {
			await this.announcementReactionsRepository.insert(record);
		} catch (e) {
			if (isDuplicateKeyValueError(e)) {
				throw new IdentifiableError('0b0d5c9f-0c07-4f0e-8a3d-6f6a4a2b0a4f', 'You are already reacting to that announcement.');
			}
			throw e;
		}

		this.globalEventService.publishBroadcastStream('announcementReacted', {
			announcementId: announcement.id,
			reaction: this.reactionService.decodeReaction(reaction).reaction,
			userId: user.id,
		});
	}

	@bindThis
	public async delete(user: { id: MiUser['id'] }, announcement: MiAnnouncement, _reaction?: string | null): Promise<void> {
		const reaction = await this.normalizeReaction(user, _reaction);

		const exist = await this.announcementReactionsRepository.findOneBy({
			announcementId: announcement.id,
			userId: user.id,
			reaction,
		});

		if (exist == null) {
			throw new IdentifiableError('9f2b4d1e-3c8a-4b6f-9d0e-7a1c5b8e2f30', 'You are not reacting to that announcement.');
		}

		await this.announcementReactionsRepository.delete({
			id: exist.id,
		});

		this.globalEventService.publishBroadcastStream('announcementUnreacted', {
			announcementId: announcement.id,
			reaction: this.reactionService.decodeReaction(exist.reaction).reaction,
			userId: user.id,
		});
	}

	/**
	 * お知らせIDごとに `{ リアクション文字列: 件数 }` を返す。
	 */
	@bindThis
	public async getCounts(announcementIds: MiAnnouncement['id'][]): Promise<Map<MiAnnouncement['id'], Record<string, number>>> {
		const result = new Map<MiAnnouncement['id'], Record<string, number>>();
		if (announcementIds.length === 0) return result;

		const rows = await this.announcementReactionsRepository
			.createQueryBuilder('reaction')
			.select('reaction.announcementId', 'announcementId')
			.addSelect('reaction.reaction', 'reaction')
			.addSelect('COUNT(*)', 'count')
			.where('reaction.announcementId IN (:...announcementIds)', { announcementIds })
			.groupBy('reaction.announcementId')
			.addGroupBy('reaction.reaction')
			.getRawMany<{ announcementId: string; reaction: string; count: string }>();

		for (const row of rows) {
			const counts = result.get(row.announcementId) ?? {};
			counts[this.reactionService.decodeReaction(row.reaction).reaction] = Number(row.count);
			result.set(row.announcementId, counts);
		}

		return result;
	}

	/**
	 * 指定ユーザーが各お知らせに付けているリアクションを返す。
	 * 1ユーザーが同一のお知らせに複数のリアクションを付けられる。
	 */
	@bindThis
	public async getMyReactions(announcementIds: MiAnnouncement['id'][], meId: MiUser['id']): Promise<Map<MiAnnouncement['id'], string[]>> {
		const result = new Map<MiAnnouncement['id'], string[]>();
		if (announcementIds.length === 0) return result;

		const reactions = await this.announcementReactionsRepository
			.createQueryBuilder('reaction')
			.where('reaction.userId = :meId', { meId })
			.andWhere('reaction.announcementId IN (:...announcementIds)', { announcementIds })
			.getMany();

		for (const reaction of reactions) {
			const decoded = this.reactionService.decodeReaction(reaction.reaction).reaction;
			const list = result.get(reaction.announcementId) ?? [];
			list.push(decoded);
			result.set(reaction.announcementId, list);
		}

		return result;
	}
}
