import assert, { rejects, strictEqual } from 'node:assert';
import * as Misskey from 'misskey-js';
import { createAccount, fetchAdmin, type LoginUser, randomUsername, resolveRemoteNote, resolveRemoteUser, sleep, uploadFile } from './utils.js';

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

	describe('Actor', () => {
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
			await sleep(1000);

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
			await sleep(1000);

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
			const channelActorInB = await resolveRemoteUser('a.test', aliceCh.actorId, bob);
			assert(channelActorInB.bannerUrl != null, 'バナー画像を設定したユーザーが連合する');
			aliceChInB = await bob.client.request('channels/show', { channelId: aliceChInB.id });
			strictEqual(channelActorInB.bannerUrl, aliceChInB.bannerUrl, 'リモートにバナー画像が設定される');
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
		test('チャンネルアカウントのTLにはチャンネル投稿しか無い', async () => {
			const notes = (await alice.client.request('users/notes', {
				userId: aliceChActorInB.id,
				withChannelNotes: true,
				withRenotes: true,
			}));

			strictEqual(notes.filter(note => note.channelId == null).length, 0);
		});
	});
	describe('Timelines', () => {
		beforeAll(async () => {
			await bob.client.request('following/create', { userId: aliceInB.id });
			//フォロー処理待ち
			await sleep(800);
		});
		describe.each([
			{ enableFanoutTimeline: true },
			{ enableFanoutTimeline: false },
		])('enableFanoutTimeline: $enableFanoutTimeline', ({ enableFanoutTimeline }) => {
			beforeAll(async () => {
				await Promise.all([
					async () => (await fetchAdmin('a.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
					async () => (await fetchAdmin('b.test')).client.request('admin/update-meta', { enableFanoutTimeline } ),
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
					channelId: carolCh.id,
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
});
