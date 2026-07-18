/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { api, initTestDb, post, randomString, signup, collectFire } from '../utils.js';
import type * as misskey from 'misskey-js';
import { MiFollowing } from '@/models/Following.js';

describe('Channel Streaming', () => {
	let Followings: any;

	const follow = async (follower: any, followee: any) => {
		await Followings.save({
			id: 'a',
			followerId: follower.id,
			followeeId: followee.id,
			followerHost: follower.host,
			followerInbox: null,
			followerSharedInbox: null,
			followeeHost: followee.host,
			followeeInbox: null,
			followeeSharedInbox: null,
		});
	};
	describe('Home Timeline', () => {
		// Local users
		let root: misskey.entities.SignupResponse;
		let aino: misskey.entities.SignupResponse;
		let barbara: misskey.entities.SignupResponse;

		let channel: misskey.entities.Channel;

		beforeAll(async () => {
			const connection = await initTestDb(true);
			Followings = connection.getRepository(MiFollowing);

			root = await signup({ username: 'root' });
			aino = await signup({ username: 'aino' });
			barbara = await signup({ username: 'barbara' });

			const ch = await api('channels/create', { username: randomString(), name: randomString() + ' Channel' }, root);
			channel = ch.body;

			await api('following/create', { userId: channel.actorId! }, aino);
			await api('following/create', { userId: channel.actorId! }, barbara);
		});

		test('チャンネル投稿がstreamingで増殖しないこと', async () => {
			const notes = await collectFire(
				barbara,
				'homeTimeline',
				() => post(aino, { text: 'foo bar', channelId: channel.id }),	// チャンネルに投稿を作成する
				msg => msg.type === 'note', // ノート・リノートとも type は 'note'
				1000,
			);

			console.log(JSON.stringify(notes, null, 2));

			// ノートが増殖しないこと
			assert.strictEqual(notes.length, 1);
		});
	});
});
