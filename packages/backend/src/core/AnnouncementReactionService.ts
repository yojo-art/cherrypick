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
	 * お知らせの reactionAcceptance 設定に応じて、リアクションを強制的に ❤ に変換する。
	 */
	@bindThis
	private async normalizeReaction(user: { id: MiUser['id']; host?: MiUser['host'] }, reaction: string | null | undefined, reactionAcceptance: 'likeOnly' | 'none' | null): Promise<string> {
		if (reactionAcceptance === 'none') {
			throw new IdentifiableError(AnnouncementReactionErrorIds.reactionsNotAllowed, 'Reactions are not allowed for this announcement.');
		}

		if (reaction == null) return FALLBACK;

		if (reactionAcceptance === 'likeOnly') {
			return FALLBACK;
		}

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

	/**
	 * 削除時の照合用。存在・権限を再評価せず、DB保存形式への変換のみ行う。
	 */
	@bindThis
	private canonicalizeReaction(reaction: string | null | undefined): string {
		if (reaction == null) return FALLBACK;

		const custom = reaction.match(isCustomEmojiRegexp);
		if (custom != null) return `:${custom[1]}:`;

		return this.reactionService.normalize(reaction);
	}

	@bindThis
	public async create(user: { id: MiUser['id']; host: MiUser['host'] }, announcement: MiAnnouncement, _reaction?: string | null): Promise<void> {
		const reaction = await this.normalizeReaction(user, _reaction, announcement.reactionAcceptance);

		const reactionLimit = (await this.roleService.getUserPolicies(user.id)).reactionLimit;
		if (reactionLimit === 0) {
			throw new IdentifiableError(AnnouncementReactionErrorIds.tooManyReactions, 'You can no longer react to this announcement.');
		}

		const count = await this.announcementReactionsRepository.countBy({
			userId: user.id,
			announcementId: announcement.id,
		});
		if (count >= reactionLimit) {
			throw new IdentifiableError(AnnouncementReactionErrorIds.tooManyReactions, 'You have reached the reaction limit for this announcement.');
		}

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
				throw new IdentifiableError(AnnouncementReactionErrorIds.alreadyReacted, 'You are already reacting to that announcement.');
			}
			throw e;
		}

		this.publishReactionEvent(announcement, 'announcementReacted', {
			announcementId: announcement.id,
			reaction: this.reactionService.decodeReaction(reaction).reaction,
			userId: user.id,
		});
	}

	@bindThis
	public async delete(user: { id: MiUser['id'] }, announcement: MiAnnouncement, _reaction?: string | null): Promise<void> {
		const reaction = this.canonicalizeReaction(_reaction);

		const exist = await this.announcementReactionsRepository.findOneBy({
			announcementId: announcement.id,
			userId: user.id,
			reaction,
		});

		if (exist == null) {
			throw new IdentifiableError(AnnouncementReactionErrorIds.notReacted, 'You are not reacting to that announcement.');
		}

		const result = await this.announcementReactionsRepository.delete({
			id: exist.id,
		});
		if (result.affected !== 1) return; // 競合で既に削除済み

		this.publishReactionEvent(announcement, 'announcementUnreacted', {
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

	/**
	 * 個人宛てお知らせは宛先ユーザーの mainStream に限定し、全体向けのみ broadcast する。
	 */
	@bindThis
	private publishReactionEvent(
		announcement: MiAnnouncement,
		type: 'announcementReacted' | 'announcementUnreacted',
		event: { announcementId: MiAnnouncement['id']; reaction: string; userId: MiUser['id'] },
	): void {
		if (announcement.userId != null) {
			this.globalEventService.publishMainStream(announcement.userId, type, event);
		} else {
			this.globalEventService.publishBroadcastStream(type, event);
		}
	}
}

export const AnnouncementReactionErrorIds = {
	alreadyReacted: '0b0d5c9f-0c07-4f0e-8a3d-6f6a4a2b0a4f',
	notReacted: '9f2b4d1e-3c8a-4b6f-9d0e-7a1c5b8e2f30',
	reactionsNotAllowed: '5dc6d2af-e34c-4cdf-9303-1875fa390d02',
	tooManyReactions: '3f8a1d2c-5b4e-4c7f-9a6d-8e2b1c0d9f4e',
} as const;
