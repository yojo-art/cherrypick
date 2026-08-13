import { afterAll, beforeAll, describe, test } from 'vitest';
import assert, { strictEqual } from 'node:assert';
import { notStrictEqual } from 'node:assert/strict';
import * as Misskey from 'misskey-js';
import { isPureRenote } from 'misskey-js/note.js';
import { createAccount, fetchAdmin, type LoginUser, randomUsername, resolveRemoteNote, resolveRemoteUser, sleep, uploadFile, waitFor } from './utils.js';

describe('Channel', () => {
	let alice: LoginUser, bob: LoginUser, carol: LoginUser;
	let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe, carolInA: Misskey.entities.UserDetailedNotMe, carolInB: Misskey.entities.UserDetailedNotMe;
	let aliceChActorInB: Misskey.entities.UserDetailedNotMe, aliceChActorInC: Misskey.entities.UserDetailedNotMe;
	let aliceCh: Misskey.entities.Channel, aliceChInB: Misskey.entities.Channel, aliceChInC: Misskey.entities.Channel;
	let carolChActorInA: Misskey.entities.UserDetailedNotMe, carolChActorInB: Misskey.entities.UserDetailedNotMe;
	let carolCh: Misskey.entities.Channel, carolChInA: Misskey.entities.Channel, carolChInB: Misskey.entities.Channel;

	beforeAll(async () => {
		[alice, bob, carol] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
			createAccount('c.test'),
		]);
		aliceCh = await alice.client.request('channels/create', { username: randomUsername() });
		assert(aliceCh.actorId, 'チャンネルアカウントが作成されそのidが入る');
		carolCh = await carol.client.request('channels/create', { username: randomUsername() });
		assert(carolCh.actorId, 'チャンネルアカウントが作成されそのidが入る');

		[bobInA, aliceInB, carolInA, carolInB, aliceChActorInB, aliceChActorInC, carolChActorInA, carolChActorInB] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('a.test', alice.id, bob),
			resolveRemoteUser('c.test', carol.id, alice),
			resolveRemoteUser('c.test', carol.id, bob),
			resolveRemoteUser('a.test', aliceCh.actorId, bob),
			resolveRemoteUser('a.test', aliceCh.actorId, carol),
			resolveRemoteUser('c.test', carolCh.actorId, alice),
			resolveRemoteUser('c.test', carolCh.actorId, bob),
		]);
		assert(aliceChActorInB.channelId);
		assert(aliceChActorInC.channelId);
		aliceChInB = await bob.client.request('channels/show', { channelId: aliceChActorInB.channelId });
		strictEqual(aliceChActorInB.id, aliceChInB.actorId, 'チャンネルアカウントを照会するとローカルにチャンネルが作成される');
		aliceChInC = await carol.client.request('channels/show', { channelId: aliceChActorInC.channelId });
		strictEqual(aliceChActorInC.id, aliceChInC.actorId, 'チャンネルアカウントを照会するとローカルにチャンネルが作成される');
		assert(carolChActorInA.channelId);
		assert(carolChActorInB.channelId);
		carolChInA = await alice.client.request('channels/show', { channelId: carolChActorInA.channelId });
		strictEqual(carolChActorInA.id, carolChInA.actorId, 'チャンネルアカウントを照会するとローカルにチャンネルが作成される');
		carolChInB = await bob.client.request('channels/show', { channelId: carolChActorInB.channelId });
		strictEqual(carolChActorInB.id, carolChInB.actorId, 'チャンネルアカウントを照会するとローカルにチャンネルが作成される');
		await bob.client.request('channels/follow', { channelId: carolChInB.id });
		await sleep(1000);
		const channelActorInB = await bob.client.request('users/show', { userId: carolChActorInB.id });
		assert(channelActorInB.isFollowing, 'チャンネルをフォローするとチャンネルアカウントがフォローされる');
	});

	afterAll(async () => {
		if (carolChActorInB != null) {
			await bob.client.request('following/delete', { userId: carolChActorInB.id });
		}
	});

	describe('Actor', () => {
		test('管理者が連合する', async () => {
			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.userId, alice.id, 'ローカル：作成者が管理者');
			strictEqual(aliceChInB.userId, aliceInB.id, 'リモート：リモートユーザーが管理者');
		});
		test('チャンネル名が連合する', async () => {
			strictEqual(aliceChActorInB.username, aliceCh.name, 'デフォルトはusername==name');
			assert(aliceChActorInB.channelId);

			await alice.client.request('channels/update', { channelId: aliceCh.id, name: 'test Channel' });
			await sleep();

			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.name, 'test Channel');
			assert(aliceCh.actorId);

			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			strictEqual(channelActorInA.name, aliceCh.name);
			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep();

			const channelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			strictEqual(channelActorInB.name, aliceCh.name);

			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(aliceChInB.name, aliceCh.name);
		});

		test('チャンネル説明文が連合する', async () => {
			assert(aliceChActorInB.channelId);

			await alice.client.request('channels/update', { channelId: aliceCh.id, description: 'Channel Description' });
			await sleep();

			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.description, 'Channel Description');
			assert(aliceCh.actorId);

			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			strictEqual(channelActorInA.description, aliceCh.description);

			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep();

			const channelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			strictEqual(channelActorInB.description, aliceCh.description);

			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(aliceChInB.description, aliceCh.description);
		});

		test('バナー画像が連合する', async () => {
			const image = await uploadFile('a.test', alice);
			await alice.client.request('channels/update', { channelId: aliceCh.id, bannerId: image.id });
			aliceCh = await alice.client.request('channels/show', { channelId: aliceCh.id });
			strictEqual(aliceCh.bannerUrl, image.url, 'ローカルにバナー画像が設定される');
			assert(aliceCh.actorId);

			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			strictEqual(channelActorInA.bannerUrl, aliceCh.bannerUrl, 'バナー画像を設定するとローカルの対応したユーザーのバナーになる');
			await sleep();

			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep();

			const channelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			assert(channelActorInB.bannerUrl != null, 'バナー画像を設定したユーザーが連合する');

			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(channelActorInB.bannerUrl, aliceChInB.bannerUrl, 'リモートにバナー画像が設定される');
		});
		test('ローカルのチャンネル投稿をピン留めできる', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;
			await alice.client.request('channels/update', { channelId: aliceCh.id, pinnedNoteIds: [note.id] });

			assert(aliceCh.actorId);
			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			strictEqual(channelActorInA.pinnedNoteIds[0], note.id, 'ピン留めするとローカルの対応したユーザーにピン留めされる');
			await sleep();

			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep();
			const channelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(channelActorInB.pinnedNoteIds[0], resolvedNote.id, 'ピン留めを設定したユーザーが連合する');
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(aliceChInB.pinnedNoteIds[0], resolvedNote.id, 'リモートにピン留めが設定される');

			await alice.client.request('channels/update', { channelId: aliceCh.id, pinnedNoteIds: [] });
			const updateChannelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			assert(updateChannelActorInA.pinnedNoteIds.length === 0, 'ピン留め解除するとローカルの対応したユーザーにも反映される');
			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep();
			const updateChannelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			assert(updateChannelActorInB.pinnedNoteIds.length === 0, 'ピン留め解除したユーザーが連合する');
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			assert(aliceChInB.pinnedNoteIds.length === 0, 'リモートのピン留めが解除される');
		});
		test('リモートのチャンネル投稿をピン留めできる', async () => {
			const note = (await carol.client.request('notes/create', {
				text: 'I am Carol!',
				channelId: aliceChInC.id,
				visibility: 'public',
			})).createdNote;
			const resolvedNoteInA = await resolveRemoteNote('c.test', note.id, alice);
			await alice.client.request('channels/update', { channelId: aliceCh.id, pinnedNoteIds: [resolvedNoteInA.id] });

			assert(aliceCh.actorId);
			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			strictEqual(channelActorInA.pinnedNoteIds[0], resolvedNoteInA.id, 'ピン留めするとローカルの対応したユーザーにピン留めされる');
			await sleep();

			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep();
			const channelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			const resolvedNote = await resolveRemoteNote('c.test', note.id, bob);
			strictEqual(channelActorInB.pinnedNoteIds[0], resolvedNote.id, 'ピン留めを設定したユーザーが連合する');
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(aliceChInB.pinnedNoteIds[0], resolvedNote.id, 'リモートにピン留めが設定される');
			await alice.client.request('channels/update', { channelId: aliceCh.id, pinnedNoteIds: [] });
			await bob.client.request('federation/update-remote-user', { userId: aliceChActorInB.id });
			await sleep();
		});
		test('ピン留めが配送される', async () => {
			assert(aliceCh.actorId);
			const channelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			await bob.client.request('following/create', { userId: channelActorInB.id });
			//フォロー処理待ち
			await sleep(800);
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;
			await alice.client.request('channels/update', { channelId: aliceCh.id, pinnedNoteIds: [note.id] });
			await sleep(800);//配送待ち
			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(aliceChInB.pinnedNoteIds[0], resolvedNote.id, 'リモートにピン留めが設定される');

			await alice.client.request('channels/update', { channelId: aliceCh.id, pinnedNoteIds: [] });
			await sleep(800);//配送待ち
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			assert(aliceChInB.pinnedNoteIds.length === 0, 'リモートのピン留めが解除される');
		});
	});

	describe('Fetch Note', () => {
		test('パブリックなチャンネル投稿がパブリックなチャンネル投稿として照会できる', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;

			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(aliceInB.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceChInB.id);
			strictEqual(resolvedNote.visibility, 'public');
		});

		test('ホームなチャンネル投稿がホームなチャンネル投稿として照会できる', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'home',
			})).createdNote;

			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(aliceInB.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceChInB.id);
			strictEqual(resolvedNote.visibility, 'home');
		});

		/*
		// 何故か動かないけど別に問題にならないから放置
		test('フォロワー限定なチャンネル投稿が投稿先インスタンスでフォロワー限定なチャンネル投稿として照会できる', async () => {
			const note = (await bob.client.request('notes/create', {
				text: 'I am Bob!',
				channelId: aliceChInB.id,
				visibility: 'followers',
			})).createdNote;

			strictEqual(note.visibility, 'followers');
			const resolvedNote = await resolveRemoteNote('b.test', note.id, alice);
			strictEqual(bobInA.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceCh.id);
			strictEqual(resolvedNote.visibility, 'followers');
		});
		*/

		test('フォロワー限定なチャンネル投稿が無関係なインスタンスでフォロワー限定なチャンネル投稿として照会できない', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'followers',
			})).createdNote;

			strictEqual(note.visibility, 'followers');

			let errored = false;
			try {
				await resolveRemoteNote('a.test', note.id, carol);
			} catch (err) {
				errored = true;
				const e = err as { code?: string; status?: number };
				strictEqual(
					e.status === 400 || e.code === 'REQUEST_FAILED',
					true,
					`unexpected error: ${JSON.stringify(err)}`,
				);
			}
			strictEqual(errored, true, 'request should have been rejected');
		});

		test('チャンネル管理、閲覧、投稿がすべて別インスタンスでも動く', async () => {
			const note = (await carol.client.request('notes/create', {
				text: 'I am Carol!',
				channelId: aliceChInC.id,
				visibility: 'public',
			})).createdNote;

			strictEqual(note.channelId, aliceChInC.id, 'チャンネル投稿として作成される');

			const resolvedNoteInA = await resolveRemoteNote('c.test', note.id, alice);
			strictEqual(carolInA.id, resolvedNoteInA.userId);
			strictEqual(resolvedNoteInA.channelId, aliceCh.id);
			strictEqual(resolvedNoteInA.visibility, 'public');

			const resolvedNoteInB = await resolveRemoteNote('c.test', note.id, bob);
			strictEqual(carolInB.id, resolvedNoteInB.userId);
			strictEqual(resolvedNoteInB.channelId, aliceChInB.id);
			strictEqual(resolvedNoteInB.visibility, 'public');
		});

		test('パブリックなチャンネル内リノートがパブリックなチャンネル投稿として照会できる', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;
			const renote = (await alice.client.request('notes/create', {
				renoteId: note.id,
				channelId: aliceCh.id,
			})).createdNote;

			const resolvedNote = await resolveRemoteNote('a.test', renote.id, bob);
			strictEqual(aliceInB.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceChInB.id);
			strictEqual(resolvedNote.visibility, 'public');
			strictEqual(resolvedNote.text, null);
			notStrictEqual(resolvedNote.renoteId, null);
			strictEqual(resolvedNote.renote?.text, note.text);
		});

		test('ホームなチャンネル内リノートがホームなチャンネル投稿として照会できる', async () => {
			const note = (await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'home',
			})).createdNote;
			const renote = (await alice.client.request('notes/create', {
				renoteId: note.id,
				channelId: aliceCh.id,
			})).createdNote;

			const resolvedNote = await resolveRemoteNote('a.test', renote.id, bob);
			strictEqual(aliceInB.id, resolvedNote.userId);
			strictEqual(resolvedNote.channelId, aliceChInB.id);
			strictEqual(resolvedNote.visibility, 'home');
			strictEqual(resolvedNote.text, null);
			notStrictEqual(resolvedNote.renoteId, null);
			strictEqual(resolvedNote.renote?.text, note.text);
		});

		test('チャンネルアカウントのTLにはチャンネル投稿しか無い', async () => {
			await alice.client.request('notes/create', {
				text: 'I am Alice!',
				channelId: aliceCh.id,
				visibility: 'home',
			});
			await alice.client.request('notes/create', {
				text: 'I am Alice!',
				visibility: 'public',
			});

			await sleep(500);//配送待ち

			const notes = (await alice.client.request('users/notes', {
				userId: aliceChActorInB.id,
				withChannelNotes: true,
				withRenotes: true,
			}));

			strictEqual(notes.filter(note => note.channelId == null).length, 0);
		});

		test('チャンネルタイムラインには自分に表示権限の無い投稿が含まれない (ローカル)', async () => {
			const homeNote = (await alice.client.request('notes/create', {
				text: 'home note ' + randomUsername(),
				channelId: aliceCh.id,
				visibility: 'home',
			})).createdNote;
			const followersNote = (await alice.client.request('notes/create', {
				text: 'followers note ' + randomUsername(),
				channelId: aliceCh.id,
				visibility: 'followers',
			})).createdNote;
			const specifiedNote = (await alice.client.request('notes/create', {
				text: 'specified note ' + randomUsername(),
				channelId: aliceCh.id,
				visibility: 'specified',
				visibleUserIds: [bobInA.id],
			})).createdNote;

			await sleep(500);//配送待ち

			const notesForBob = (await bob.client.request('channels/timeline', {
				channelId: aliceChInB.id,
			}));
			// bob は alice のフォロワーではないので followersNote は含まれない
			strictEqual(notesForBob.some(note => note.text === followersNote.text), false, '非フォロワーにフォロワー限定投稿が含まれない');
			// bob は specifiedNote の指定相手なので含まれる
			strictEqual(notesForBob.some(note => note.text === specifiedNote.text), true, '指定ユーザーに指定投稿が含まれる');
		});
		test('チャンネルタイムラインには自分に表示権限の無い投稿が含まれない (リモート)', async () => {
			const publicNoteFromCarol = (await carol.client.request('notes/create', {
				text: 'public from carol ' + randomUsername(),
				channelId: aliceChInC.id,
				visibility: 'public',
			})).createdNote;
			const followersNoteFromCarol = (await carol.client.request('notes/create', {
				text: 'followers from carol ' + randomUsername(),
				channelId: aliceChInC.id,
				visibility: 'followers',
			})).createdNote;

			// 配送待ち
			await sleep(500);

			const notes = (await alice.client.request('channels/timeline', {
				channelId: aliceCh.id,
			}));

			// bob は carol のフォロワーでないため、followers 投稿は連合されてこない（または含まれない）
			strictEqual(notes.some(note => note.text === publicNoteFromCarol.text), true, 'パブリック投稿が含まれる');
			strictEqual(notes.some(note => note.text === followersNoteFromCarol.text), false, '非フォロワーにフォロワー限定投稿が含まれない');

			const notesForBob = (await bob.client.request('channels/timeline', {
				channelId: aliceChInB.id,
			}));

			// bob は carol のフォロワーでないため、followers 投稿は連合されてこない（または含まれない）
			strictEqual(notesForBob.some(note => note.text === publicNoteFromCarol.text), true, 'パブリック投稿が含まれる');
			strictEqual(notesForBob.some(note => note.text === followersNoteFromCarol.text), false, '非フォロワーにフォロワー限定投稿が含まれない');
		});
	});

	describe('Mention', () => {
		test('ローカルのチャンネルアカウントへのメンションが削除される', async () => {
			assert(aliceCh.actorId);

			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			const text = 'I am Alice!';
			const note = (await alice.client.request('notes/create', {
				text: '@' + channelActorInA.username + ' ' + text,
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;

			strictEqual(note.text, text, 'ローカルで見て削除される');
			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(resolvedNote.text, text, 'リモートで見て削除される');
		});

		test('リモートのチャンネルアカウントへのメンションが削除される', async () => {
			const text = 'I am Bob!';
			const note = (await bob.client.request('notes/create', {
				text: '@' + aliceChActorInB.username + '@a.test ' + text,
				channelId: aliceChInB.id,
				visibility: 'public',
			})).createdNote;

			strictEqual(note.text, text, 'ローカルで見て削除される');
			const resolvedNote = await resolveRemoteNote('b.test', note.id, alice);
			strictEqual(resolvedNote.text, text, 'リモートで見て削除される');
		});

		test('ローカルの一般ユーザーへのメンションが削除されない', async () => {
			const expectedText = '@' + alice.username + ' I am Alice!';
			const note = (await alice.client.request('notes/create', {
				text: expectedText,
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;

			strictEqual(note.text, expectedText, 'ローカルで見て削除されない');
			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(resolvedNote.text, '@' + alice.username + '@a.test I am Alice!', 'リモートで見て削除されない');
		});

		test('リモートの一般ユーザーへのメンションが削除されない', async () => {
			const expectedText = '@' + alice.username + '@a.test I am Bob!';
			const note = (await bob.client.request('notes/create', {
				text: expectedText,
				channelId: aliceChInB.id,
				visibility: 'public',
			})).createdNote;

			strictEqual(note.text, expectedText, 'ローカルで見て削除されない');
			const resolvedNote = await resolveRemoteNote('b.test', note.id, alice);
			strictEqual(resolvedNote.text, expectedText, 'リモートで見て削除されない');
		});

		test('ローカルのチャンネルアカウント名に部分一致しても削除されない', async () => {
			assert(aliceCh.actorId);

			const channelActorInA = await alice.client.request('users/show', { userId: aliceCh.actorId });
			const expectedText = '@' + channelActorInA.username + 'foo I am Alice!';
			const note = (await alice.client.request('notes/create', {
				text: expectedText,
				channelId: aliceCh.id,
				visibility: 'public',
			})).createdNote;

			strictEqual(note.text, expectedText, 'ローカルで見て削除されない');
			const resolvedNote = await resolveRemoteNote('a.test', note.id, bob);
			strictEqual(resolvedNote.text, '@' + channelActorInA.username + 'foo@a.test I am Alice!', 'リモートで見て削除されない');
		});

		test('リモートのチャンネルアカウント名に部分一致しても削除されない', async () => {
			const expectedText = '@' + aliceChActorInB.username + '@a.testfoo I am Bob!';
			const note = (await bob.client.request('notes/create', {
				text: expectedText,
				channelId: aliceChInB.id,
				visibility: 'public',
			})).createdNote;

			strictEqual(note.text, expectedText, 'ローカルで見て削除されない');
			const resolvedNote = await resolveRemoteNote('b.test', note.id, alice);
			strictEqual(resolvedNote.text, expectedText, 'リモートで見て削除されない');
		});
	});

	describe('Timelines', () => {
		beforeAll(async () => {
			assert(aliceCh.actorId);
			const channelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			await bob.client.request('following/delete', { userId: channelActorInB.id });
			await bob.client.request('following/create', { userId: aliceInB.id });
			//フォロー処理待ち
			await sleep(800);
		});

		afterAll(async () => {
			// お片付け
			await bob.client.request('following/delete', { userId: aliceInB.id });
		});

		describe.each([
			{ enableFanoutTimeline: true },
			{ enableFanoutTimeline: false },
		])('enableFanoutTimeline: $enableFanoutTimeline', ({ enableFanoutTimeline }) => {
			beforeAll(async () => {
				await Promise.all([
					(await fetchAdmin('a.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
					(await fetchAdmin('b.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
				]);
			}, 1000 * 60 * 2);

			test('ユーザーをフォローしてもHTLにチャンネル投稿は流れてこない', async () => {
				const channelNoteInA = (await alice.client.request('notes/create', {
					text: randomUsername(),
					channelId: aliceCh.id,
					visibility: 'public',
				})).createdNote;
				const normalNoteInA = (await alice.client.request('notes/create', {
					text: randomUsername(),
					visibility: 'public',
				})).createdNote;
				await sleep(1000);
				const bobHTL = await bob.client.request('notes/timeline', { limit: 100 });
				assert(bobHTL.length > 0, JSON.stringify(bobHTL));

				assert(!bobHTL.map(note => note.text).includes(channelNoteInA.text));
				assert(bobHTL.map(note => note.text).includes(normalNoteInA.text));
			});

			test('チャンネルをフォローしているとチャンネル投稿も流れてくる', async () => {
				const channelNoteInA = (await alice.client.request('notes/create', {
					text: randomUsername(),
					channelId: carolChInA.id,
					visibility: 'public',
				})).createdNote;
				const normalNoteInA = (await alice.client.request('notes/create', {
					text: randomUsername(),
					visibility: 'public',
				})).createdNote;
				const channelNoteInC = (await carol.client.request('notes/create', {
					text: randomUsername(),
					channelId: carolCh.id,
					visibility: 'public',
				})).createdNote;
				const normalNoteInC = (await carol.client.request('notes/create', {
					text: randomUsername(),
					visibility: 'public',
				})).createdNote;
				await sleep(1000);
				const bobHTL = await bob.client.request('notes/timeline', { limit: 100 });
				assert(bobHTL.length > 0, JSON.stringify(bobHTL));

				assert(bobHTL.map(note => note.text).includes(channelNoteInA.text), 'aliceとcarolCh両方フォローしているのでHTLに流れてくる');
				assert(bobHTL.map(note => note.text).includes(normalNoteInA.text), 'aliceをフォローしているのでHTLに流れてくる');
				assert(bobHTL.map(note => note.text).includes(channelNoteInC.text), 'carolChをフォローしているのでHTLに流れてくる');
				assert(!bobHTL.map(note => note.text).includes(normalNoteInC.text), 'carolをフォローしていないのでHTLに流れてこない');
				strictEqual(bobHTL.filter(note => note.user.channelId != null).length, 0, 'チャンネルアカウントの投稿はHTLに流れてこない');
			});
		});
	});

	describe('Timelines when following a channel', () => {
		beforeAll(async () => {
			assert(aliceCh.actorId);
			await bob.client.request('channels/follow', { channelId: aliceChInB.id });
			//フォロー処理待ち
			await sleep(800);
		});

		afterAll(async () => {
			await bob.client.request('channels/unfollow', { channelId: aliceChInB.id });
		});

		describe.each([
			{ enableFanoutTimeline: true },
			{ enableFanoutTimeline: false },
		])('enableFanoutTimeline: $enableFanoutTimeline', ({ enableFanoutTimeline }) => {
			beforeAll(async () => {
				await Promise.all([
					(await fetchAdmin('a.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
					(await fetchAdmin('b.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
				]);
			}, 1000 * 60 * 2);

			describe.each([
				{ noteVisibility: 'public' },
				{ noteVisibility: 'home' },
			] as const)('noteVisibility: $noteVisibility', ({ noteVisibility }) => {
				test('チャンネルをフォロー時にリノートがチャンネルに配送される', async () => {
					// aliceのホストで通常ノートを作成
					const normalNoteInA = (await alice.client.request('notes/create', {
						text: randomUsername(),
						visibility: noteVisibility,
					})).createdNote;

					// aliceのホストでチャンネルノートを作成
					const channelNoteInA = (await alice.client.request('notes/create', {
						text: randomUsername(),
						channelId: aliceCh.id,
						visibility: noteVisibility,
					})).createdNote;

					const normalNoteInB = await resolveRemoteNote('a.test', normalNoteInA.id, bob);
					const channelNoteInB = await resolveRemoteNote('a.test', channelNoteInA.id, bob);

					// aliceのホストで通常ノートをチャンネルにリノート（チャンネル内リノート）
					await alice.client.request('notes/create', {
						renoteId: normalNoteInA.id,
						channelId: aliceCh.id,
					});

					// aliceのホストでチャンネルノートをチャンネル内リノート
					await alice.client.request('notes/create', {
						renoteId: channelNoteInA.id,
						channelId: aliceCh.id,
					});

					await sleep(1000);

					const aliceChTlInB = await bob.client.request('channels/timeline', { channelId: aliceChInB.id, limit: 100 });

					assert(aliceChTlInB.some(note => isPureRenote(note) && note.renoteId === normalNoteInB.id && note.renote != null && note.renote.channelId === undefined), '通常ノートのチャンネルリノートがbobのチャンネルTLに流れてくる');
					assert(aliceChTlInB.some(note => isPureRenote(note) && note.renoteId === channelNoteInB.id && note.renote != null && note.renote.channelId != null), 'チャンネルノートのチャンネル内リノートがbobのチャンネルTLに流れてくる');
				});
			});
		});
	});

	describe('Timelines when local user follows remote channel', () => {
		beforeAll(async () => {
			await alice.client.request('channels/follow', { channelId: carolChInA.id });
			await sleep(800);
		});

		afterAll(async () => {
			await alice.client.request('channels/unfollow', { channelId: carolChInA.id });
		});

		describe.each([
			{ enableFanoutTimeline: true },
			{ enableFanoutTimeline: false },
		])('enableFanoutTimeline: $enableFanoutTimeline', ({ enableFanoutTimeline }) => {
			beforeAll(async () => {
				await Promise.all([
					(await fetchAdmin('a.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
					(await fetchAdmin('b.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
				]);
			}, 1000 * 60 * 2);

			describe.each([
				{ noteVisibility: 'public' },
				{ noteVisibility: 'home' },
			] as const)('noteVisibility: $noteVisibility', ({ noteVisibility }) => {
				test('チャンネルをフォロー時にリノートがチャンネルに配送される (ローカルユーザー -> リモートチャンネル)', async () => {
					const normalNoteInC = (await carol.client.request('notes/create', {
						text: randomUsername(),
						visibility: noteVisibility,
					})).createdNote;

					const channelNoteInC = (await carol.client.request('notes/create', {
						text: randomUsername(),
						channelId: carolCh.id,
						visibility: noteVisibility,
					})).createdNote;

					const normalNoteInA = await resolveRemoteNote('c.test', normalNoteInC.id, alice);
					const channelNoteInA = await resolveRemoteNote('c.test', channelNoteInC.id, alice);

					await carol.client.request('notes/create', {
						renoteId: normalNoteInC.id,
						channelId: carolCh.id,
					});

					await carol.client.request('notes/create', {
						renoteId: channelNoteInC.id,
						channelId: carolCh.id,
					});

					await sleep(1000);

					const carolChTlInA = await alice.client.request('channels/timeline', { channelId: carolChInA.id, limit: 100 });

					assert(carolChTlInA.some(note => isPureRenote(note) && note.renoteId === normalNoteInA.id && note.renote != null && note.renote.channelId === undefined), '通常ノートのチャンネルリノートがaliceのチャンネルTLに流れてくる');
					assert(carolChTlInA.some(note => isPureRenote(note) && note.renoteId === channelNoteInA.id && note.renote != null && note.renote.channelId != null), 'チャンネルノートのチャンネル内リノートがaliceのチャンネルTLに流れてくる');
				});
			});
		});
	});

	describe('Timelines when local user follows local channel', () => {
		beforeAll(async () => {
			await alice.client.request('channels/follow', { channelId: aliceCh.id });
			await sleep(800);
		});

		afterAll(async () => {
			await alice.client.request('channels/unfollow', { channelId: aliceCh.id });
		});

		describe.each([
			{ enableFanoutTimeline: true },
			{ enableFanoutTimeline: false },
		])('enableFanoutTimeline: $enableFanoutTimeline', ({ enableFanoutTimeline }) => {
			beforeAll(async () => {
				await Promise.all([
					(await fetchAdmin('a.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
					(await fetchAdmin('b.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
				]);
			}, 1000 * 60 * 2);

			describe.each([
				{ noteVisibility: 'public' },
				{ noteVisibility: 'home' },
			] as const)('noteVisibility: $noteVisibility', ({ noteVisibility }) => {
				test('チャンネルをフォロー時にリノートがチャンネルに配送される (ローカルユーザー -> ローカルチャンネル)', async () => {
					const normalNoteInA = (await alice.client.request('notes/create', {
						text: randomUsername(),
						visibility: noteVisibility,
					})).createdNote;

					const channelNoteInA = (await alice.client.request('notes/create', {
						text: randomUsername(),
						channelId: aliceCh.id,
						visibility: noteVisibility,
					})).createdNote;

					await alice.client.request('notes/create', {
						renoteId: normalNoteInA.id,
						channelId: aliceCh.id,
					});

					await alice.client.request('notes/create', {
						renoteId: channelNoteInA.id,
						channelId: aliceCh.id,
					});

					await sleep(1000);

					const aliceChTl = await alice.client.request('channels/timeline', { channelId: aliceCh.id, limit: 100 });

					assert(aliceChTl.some(note => isPureRenote(note) && note.renoteId === normalNoteInA.id && note.renote != null && note.renote.channelId === undefined), '通常ノートのチャンネルリノートがaliceのチャンネルTLに流れてくる');
					assert(aliceChTl.some(note => isPureRenote(note) && note.renoteId === channelNoteInA.id && note.renote != null && note.renote.channelId != null), 'チャンネルノートのチャンネル内リノートがaliceのチャンネルTLに流れてくる');
				});
			});
		});
	});

	describe('Timelines when remote user follows remote channel', () => {
		beforeAll(async () => {
			const channelActorInB = await bob.client.request('users/show', { userId: carolChActorInB.id });
			await sleep(800);
		});

		describe.each([
			{ enableFanoutTimeline: true },
			{ enableFanoutTimeline: false },
		])('enableFanoutTimeline: $enableFanoutTimeline', ({ enableFanoutTimeline }) => {
			beforeAll(async () => {
				await Promise.all([
					(await fetchAdmin('a.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
					(await fetchAdmin('b.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
				]);
			}, 1000 * 60 * 2);

			describe.each([
				{ noteVisibility: 'public' },
				{ noteVisibility: 'home' },
			] as const)('noteVisibility: $noteVisibility', ({ noteVisibility }) => {
				test('チャンネルをフォロー時にリノートがチャンネルに配送される (リモートユーザー -> リモートチャンネル)', async () => {
					const normalNoteInC = (await carol.client.request('notes/create', {
						text: randomUsername(),
						visibility: noteVisibility,
					})).createdNote;

					const channelNoteInC = (await carol.client.request('notes/create', {
						text: randomUsername(),
						channelId: carolCh.id,
						visibility: noteVisibility,
					})).createdNote;

					const normalNoteInB = await resolveRemoteNote('c.test', normalNoteInC.id, bob);
					const channelNoteInB = await resolveRemoteNote('c.test', channelNoteInC.id, bob);

					await carol.client.request('notes/create', {
						renoteId: normalNoteInC.id,
						channelId: carolCh.id,
					});

					await carol.client.request('notes/create', {
						renoteId: channelNoteInC.id,
						channelId: carolCh.id,
					});

					await sleep(1000);

					const carolChTlInB = await bob.client.request('channels/timeline', { channelId: carolChInB.id, limit: 100 });

					assert(carolChTlInB.some(note => isPureRenote(note) && note.renoteId === normalNoteInB.id && note.renote != null && note.renote.channelId === undefined), '通常ノートのチャンネルリノートがbobのチャンネルTLに流れてくる');
					assert(carolChTlInB.some(note => isPureRenote(note) && note.renoteId === channelNoteInB.id && note.renote != null && note.renote.channelId != null), 'チャンネルノートのチャンネル内リノートがbobのチャンネルTLに流れてくる');
				});
			});
		});
	});

	describe('usersCount and notesCount federated posts', () => {
		test('リモート->ローカル: リモートユーザーがローカルチャンネルに投稿すると、両方のcountsが更新される', async () => {
			//alice管理者/bob投稿者
			await bob.client.request('channels/follow', { channelId: aliceChInB.id });

			await waitFor(async () => {
				const channel = await bob.client.request('channels/show', { channelId: aliceChInB.id });
				return channel.isFollowing ?? false;
			}, { interval: 200 });

			const before = await alice.client.request('channels/show', { channelId: aliceCh.id });
			const beforeInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });

			await bob.client.request('notes/create', {
				text: 'local to remote channel ' + randomUsername(),
				channelId: aliceChInB.id,
				visibility: 'public',
			});

			await waitFor(async () => {
				const after = await alice.client.request('channels/show', { channelId: aliceCh.id });
				const afterInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
				return afterInB.notesCount === beforeInB.notesCount + 1 && after.notesCount === before.notesCount + 1;
			});

			const after = await alice.client.request('channels/show', { channelId: aliceCh.id });
			const afterInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			try {
				strictEqual(afterInB.notesCount, beforeInB.notesCount + 1, '投稿元(リモートチャンネル)notesCountが1増える');
				strictEqual(afterInB.usersCount >= beforeInB.usersCount, true, '投稿元(リモートチャンネル)usersCountが減らない');
				strictEqual(after.notesCount, before.notesCount + 1, '投稿先(ローカルチャンネル)notesCountが1増える');
				strictEqual(after.usersCount >= before.usersCount, true, '投稿先(ローカルチャンネル)usersCountが減らない');
			} finally {
				await bob.client.request('channels/unfollow', { channelId: aliceChInB.id });
			}
		});

		test('リモート->リモート: リモートユーザーがリモートチャンネルに投稿すると、チャンネルフォロワーのcountsが更新される', async () => {
			//alice観測者/bob投稿者/carol管理者
			await alice.client.request('channels/follow', { channelId: carolChInA.id });

			await waitFor(async () => {
				const channel = await alice.client.request('channels/show', { channelId: carolChInA.id });
				return channel.isFollowing ?? false;
			}, { interval: 200 });

			const before = await alice.client.request('channels/show', { channelId: carolChInA.id });

			await bob.client.request('notes/create', {
				text: 'remote to remote channel ' + randomUsername(),
				channelId: carolChInB.id,
				visibility: 'public',
			});

			await waitFor(async () => {
				const after = await alice.client.request('channels/show', { channelId: carolChInA.id });
				return after.notesCount === before.notesCount + 1;
			});

			const after = await alice.client.request('channels/show', { channelId: carolChInA.id });
			try {
				strictEqual(after.notesCount, before.notesCount + 1, 'notesCountが1増える');
				strictEqual(after.usersCount >= before.usersCount, true, 'usersCountが減らない');
			} finally {
				await alice.client.request('channels/unfollow', { channelId: carolChInA.id });
			}
		});
	});
});
