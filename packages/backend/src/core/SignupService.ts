/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { generateKeyPair, randomUUID } from 'node:crypto';
import * as mfm from 'mfc-js';
import { Inject, Injectable } from '@nestjs/common';
//import bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { DataSource, IsNull } from 'typeorm';
import { DriveFile } from 'misskey-js/entities.js';
import { DI } from '@/di-symbols.js';
import type { ChannelsRepository, MiMeta, UsedUsernamesRepository, UsersRepository } from '@/models/_.js';
import { MiUser } from '@/models/User.js';
import { MiChannel } from '@/models/Channel.js';
import { MiUserProfile } from '@/models/UserProfile.js';
import { IdService } from '@/core/IdService.js';
import { MiUserKeypair } from '@/models/UserKeypair.js';
import { MiUsedUsername } from '@/models/UsedUsername.js';
import { generateNativeUserToken } from '@/misc/token.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import UsersChart from '@/core/chart/charts/users.js';
import { UtilityService } from '@/core/UtilityService.js';
import { UserService } from '@/core/UserService.js';
import { SystemAccountService } from '@/core/SystemAccountService.js';
import { MetaService } from '@/core/MetaService.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { HashtagService } from './HashtagService.js';

@Injectable()
export class SignupService {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.usedUsernamesRepository)
		private usedUsernamesRepository: UsedUsernamesRepository,

		private utilityService: UtilityService,
		private userService: UserService,
		private userEntityService: UserEntityService,
		private idService: IdService,
		private systemAccountService: SystemAccountService,
		private metaService: MetaService,
		private usersChart: UsersChart,
		private hashtagService: HashtagService,
	) {
	}

	@bindThis
	public async signup(opts: {
		username: MiUser['username'];
		password?: string | null;
		passwordHash?: MiUserProfile['password'] | null;
		host?: string | null;
		ignorePreservedUsernames?: boolean;
	}) {
		const { username, password, passwordHash, host } = opts;
		let hash = passwordHash;

		// Validate username
		if (!this.userEntityService.validateLocalUsername(username)) {
			throw new Error('INVALID_USERNAME');
		}

		if (password != null && passwordHash == null) {
			// Validate password
			if (!this.userEntityService.validatePassword(password)) {
				throw new Error('INVALID_PASSWORD');
			}

			// Generate hash of password
			//const salt = await bcrypt.genSalt(8);
			hash = await argon2.hash(password);
		}

		// Generate secret
		const secret = generateNativeUserToken();

		// Check username duplication
		if (await this.usersRepository.exists({ where: { usernameLower: username.toLowerCase(), host: IsNull() } })) {
			throw new Error('DUPLICATED_USERNAME');
		}

		// Check deleted username duplication
		if (await this.usedUsernamesRepository.exists({ where: { username: username.toLowerCase() } })) {
			throw new Error('USED_USERNAME');
		}

		if (!opts.ignorePreservedUsernames && this.meta.rootUserId != null) {
			const isPreserved = this.meta.preservedUsernames.map(x => x.toLowerCase()).includes(username.toLowerCase());
			if (isPreserved) {
				throw new Error('USED_USERNAME');
			}

			const hasProhibitedWords = this.utilityService.isKeyWordIncluded(username.toLowerCase(), this.meta.prohibitedWordsForNameOfUser);
			if (hasProhibitedWords) {
				throw new Error('USED_USERNAME');
			}
		}

		const keyPair = await new Promise<string[]>((res, rej) =>
			generateKeyPair('rsa', {
				modulusLength: 2048,
				publicKeyEncoding: {
					type: 'spki',
					format: 'pem',
				},
				privateKeyEncoding: {
					type: 'pkcs8',
					format: 'pem',
					cipher: undefined,
					passphrase: undefined,
				},
			}, (err, publicKey, privateKey) =>
				err ? rej(err) : res([publicKey, privateKey]),
			));

		let account!: MiUser;

		// Start transaction
		await this.db.transaction(async transactionalEntityManager => {
			const exist = await transactionalEntityManager.findOneBy(MiUser, {
				usernameLower: username.toLowerCase(),
				host: IsNull(),
			});

			if (exist) throw new Error(' the username is already used');

			account = await transactionalEntityManager.save(new MiUser({
				id: this.idService.gen(),
				username: username,
				usernameLower: username.toLowerCase(),
				host: this.utilityService.toPunyNullable(host),
				token: secret,
			}));

			await transactionalEntityManager.save(new MiUserKeypair({
				publicKey: keyPair[0],
				privateKey: keyPair[1],
				userId: account.id,
			}));

			await transactionalEntityManager.save(new MiUserProfile({
				userId: account.id,
				autoAcceptFollowed: true,
				password: hash,
			}));

			await transactionalEntityManager.save(new MiUsedUsername({
				createdAt: new Date(),
				username: username.toLowerCase(),
			}));
		});

		this.usersChart.update(account, true);
		this.userService.notifySystemWebhook(account, 'userCreated');

		if (this.meta.rootUserId == null) {
			await this.metaService.update({ rootUserId: account.id });
		}

		return { account, secret };
	}
	@bindThis
	public async signupChannel(opts: {
		username: MiUser['username'];
		name?: MiUser['name'];
		ownerId: MiUser['id'],
		description?: MiChannel['description'];
		bannerId?: DriveFile['id'];
		ignorePreservedUsernames?: boolean;
	}) {
		const { username, name, bannerId, description, ownerId } = opts;

		// Validate username
		if (!this.userEntityService.validateLocalUsername(username)) {
			throw new Error('INVALID_USERNAME');
		}
		const password = randomUUID() + randomUUID();

		// Generate hash of password
		//const salt = await bcrypt.genSalt(8);
		//どうせログインしないのでパスワードは適当
		const hash = await argon2.hash(password);

		// Generate secret
		const secret = generateNativeUserToken();

		// Check username duplication
		if (await this.usersRepository.exists({ where: { usernameLower: username.toLowerCase(), host: IsNull() } })) {
			throw new Error('DUPLICATED_USERNAME');
		}

		// Check deleted username duplication
		if (await this.usedUsernamesRepository.exists({ where: { username: username.toLowerCase() } })) {
			throw new Error('USED_USERNAME');
		}

		if (!opts.ignorePreservedUsernames && this.meta.rootUserId != null) {
			const isPreserved = this.meta.preservedUsernames.map(x => x.toLowerCase()).includes(username.toLowerCase());
			if (isPreserved) {
				throw new Error('USED_USERNAME');
			}

			const hasProhibitedWords = this.utilityService.isKeyWordIncluded(username.toLowerCase(), this.meta.prohibitedWordsForNameOfUser);
			if (hasProhibitedWords) {
				throw new Error('USED_USERNAME');
			}
		}

		const keyPair = await new Promise<string[]>((res, rej) =>
			generateKeyPair('rsa', {
				modulusLength: 2048,
				publicKeyEncoding: {
					type: 'spki',
					format: 'pem',
				},
				privateKeyEncoding: {
					type: 'pkcs8',
					format: 'pem',
					cipher: undefined,
					passphrase: undefined,
				},
			}, (err, publicKey, privateKey) =>
				err ? rej(err) : res([publicKey, privateKey]),
			));
		let emojis = [] as string[];
		if (name != null) {
			const tokens = mfm.parseSimple(name);
			emojis = emojis.concat(extractCustomEmojisFromMfm(tokens));
		}
		let tags = [] as string[];
		if (description != null) {
			const tokens = mfm.parse(description);
			emojis = emojis.concat(extractCustomEmojisFromMfm(tokens));
			tags = extractHashtags(tokens).map(tag => normalizeForSearch(tag)).splice(0, 32);
		}
		let account!: MiUser;
		let channel!:MiChannel;

		// Start transaction
		await this.db.transaction(async transactionalEntityManager => {
			const exist = await transactionalEntityManager.findOneBy(MiUser, {
				usernameLower: username.toLowerCase(),
				host: IsNull(),
			});

			if (exist) throw new Error(' the username is already used');

			account = await transactionalEntityManager.save(new MiUser({
				id: this.idService.gen(),
				username: username,
				usernameLower: username.toLowerCase(),
				host: null,
				emojis,
				tags,
				token: secret,
				bannerId: bannerId ?? null,
			}));

			await transactionalEntityManager.save(new MiUserKeypair({
				publicKey: keyPair[0],
				privateKey: keyPair[1],
				userId: account.id,
			}));

			await transactionalEntityManager.save(new MiUserProfile({
				userId: account.id,
				autoAcceptFollowed: true,
				password: hash,
				description,
			}));

			await transactionalEntityManager.save(new MiUsedUsername({
				createdAt: new Date(),
				username: username.toLowerCase(),
			}));
			channel = await transactionalEntityManager.save(new MiChannel({
				id: this.idService.gen(),
				name: name ?? username,
				userId: ownerId,
				actor: account,
				actorId: account.id,
				description,
			}));
			await transactionalEntityManager.update(MiUser, {
				id: account.id,
			}, {
				isBot: true,
				channelId: channel.id,
				channel: channel,
			});
			account.isBot = true;
			account.channel = channel;
			account.channelId = channel.id;
		});

		this.usersChart.update(account, true);
		//一旦WebHookはなし
		//this.userService.notifySystemWebhook(account, 'userCreated');

		return { account, channel };
	}
}

