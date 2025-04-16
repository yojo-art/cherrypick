import assert, { rejects, strictEqual } from 'node:assert';
import * as Misskey from 'cherrypick-js';
import { createAccount, deepStrictEqualWithExcludedFields, fetchAdmin, type LoginUser, resolveRemoteNote, resolveRemoteUser, sleep } from './utils.js';

const [aAdmin, bAdmin] = await Promise.all([
	fetchAdmin('a.test'),
	fetchAdmin('b.test'),
]);

describe('User', () => {
	describe('Profile', () => {
		describe('Consistency of profile', () => {
			let alice: LoginUser;
			let aliceWatcher: LoginUser;
			let aliceWatcherInB: LoginUser;

			beforeAll(async () => {
				alice = await createAccount('a.test');
				[
					aliceWatcher,
					aliceWatcherInB,
				] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);
			});

			test('Check consistency', async () => {
				const aliceInA = await aliceWatcher.client.request('users/show', { userId: alice.id });
				const resolved = await resolveRemoteUser('a.test', aliceInA.id, aliceWatcherInB);
				const aliceInB = await aliceWatcherInB.client.request('users/show', { userId: resolved.id });

				// console.log(`a.test: ${JSON.stringify(aliceInA, null, '\t')}`);
				// console.log(`b.test: ${JSON.stringify(aliceInB, null, '\t')}`);

				deepStrictEqualWithExcludedFields(aliceInA, aliceInB, [
					'id',
					'host',
					'avatarUrl',
					'instance',
					'badgeRoles',
					'url',
					'uri',
					'createdAt',
					'lastFetchedAt',
					'publicReactions',
				]);
			});
		});

		describe('ffVisibility is federated', () => {
			let alice: LoginUser, bob: LoginUser;
			let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);

				[bobInA, aliceInB] = await Promise.all([
					resolveRemoteUser('b.test', bob.id, alice),
					resolveRemoteUser('a.test', alice.id, bob),
				]);

				// NOTE: follow each other
				await Promise.all([
					alice.client.request('following/create', { userId: bobInA.id }),
					bob.client.request('following/create', { userId: aliceInB.id }),
				]);
				await sleep();
			});

			test('Visibility set public by default', async () => {
				for (const user of await Promise.all([
					alice.client.request('users/show', { userId: bobInA.id }),
					bob.client.request('users/show', { userId: aliceInB.id }),
				])) {
					strictEqual(user.followersVisibility, 'public');
					strictEqual(user.followingVisibility, 'public');
				}
			});

			/** FIXME: not working */
			test.skip('Setting private for followersVisibility is federated', async () => {
				await Promise.all([
					alice.client.request('i/update', { followersVisibility: 'private' }),
					bob.client.request('i/update', { followersVisibility: 'private' }),
				]);
				await sleep();

				for (const user of await Promise.all([
					alice.client.request('users/show', { userId: bobInA.id }),
					bob.client.request('users/show', { userId: aliceInB.id }),
				])) {
					strictEqual(user.followersVisibility, 'private');
					strictEqual(user.followingVisibility, 'public');
				}
			});

			test.skip('Setting private for followingVisibility is federated', async () => {
				await Promise.all([
					alice.client.request('i/update', { followingVisibility: 'private' }),
					bob.client.request('i/update', { followingVisibility: 'private' }),
				]);
				await sleep();

				for (const user of await Promise.all([
					alice.client.request('users/show', { userId: bobInA.id }),
					bob.client.request('users/show', { userId: aliceInB.id }),
				])) {
					strictEqual(user.followersVisibility, 'private');
					strictEqual(user.followingVisibility, 'private');
				}
			});
		});

		describe('isCat is federated', () => {
			let alice: LoginUser, bob: LoginUser;
			let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);

				[bobInA, aliceInB] = await Promise.all([
					resolveRemoteUser('b.test', bob.id, alice),
					resolveRemoteUser('a.test', alice.id, bob),
				]);
			});

			test('Not isCat for default', () => {
				strictEqual(aliceInB.isCat, false);
			});

			test('Becoming a cat is sent to their followers', async () => {
				await bob.client.request('following/create', { userId: aliceInB.id });
				await sleep();

				await alice.client.request('i/update', { isCat: true });
				await sleep();

				const res = await bob.client.request('users/show', { userId: aliceInB.id });
				strictEqual(res.isCat, true);
			});
		});

		describe('Pinning Notes', () => {
			let alice: LoginUser, bob: LoginUser;
			let aliceInB: Misskey.entities.UserDetailedNotMe;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);
				aliceInB = await resolveRemoteUser('a.test', alice.id, bob);

				await bob.client.request('following/create', { userId: aliceInB.id });
			});

			test('Pinning localOnly Note is not delivered', async () => {
				const note = (await alice.client.request('notes/create', { text: 'a', localOnly: true })).createdNote;
				await alice.client.request('i/pin', { noteId: note.id });
				await sleep();

				const _aliceInB = await bob.client.request('users/show', { userId: aliceInB.id });
				strictEqual(_aliceInB.pinnedNoteIds.length, 0);
			});

			test('Pinning followers-only Note is not delivered', async () => {
				const note = (await alice.client.request('notes/create', { text: 'a', visibility: 'followers' })).createdNote;
				await alice.client.request('i/pin', { noteId: note.id });
				await sleep();

				const _aliceInB = await bob.client.request('users/show', { userId: aliceInB.id });
				strictEqual(_aliceInB.pinnedNoteIds.length, 0);
			});

			let pinnedNote: Misskey.entities.Note;

			test('Pinning normal Note is delivered', async () => {
				pinnedNote = (await alice.client.request('notes/create', { text: 'a' })).createdNote;
				await alice.client.request('i/pin', { noteId: pinnedNote.id });
				await sleep();

				const _aliceInB = await bob.client.request('users/show', { userId: aliceInB.id });
				strictEqual(_aliceInB.pinnedNoteIds.length, 1);
				const pinnedNoteInB = await resolveRemoteNote('a.test', pinnedNote.id, bob);
				strictEqual(_aliceInB.pinnedNotes[0].id, pinnedNoteInB.id);
			});

			test('Unpinning normal Note is delivered', async () => {
				await alice.client.request('i/unpin', { noteId: pinnedNote.id });
				await sleep();

				const _aliceInB = await bob.client.request('users/show', { userId: aliceInB.id });
				strictEqual(_aliceInB.pinnedNoteIds.length, 0);
			});
		});
	});
	describe('Clips', () => {
		let alice: LoginUser, bob: LoginUser;
		let aliceInB: Misskey.entities.UserDetailedNotMe, bobInA: Misskey.entities.UserDetailedNotMe;

		beforeAll(async () => {
			[alice, bob] = await Promise.all([
				createAccount('a.test'),
				createAccount('b.test'),
			]);
			aliceInB = await resolveRemoteUser('a.test', alice.id, bob);
			bobInA = await resolveRemoteUser('b.test', bob.id, alice);
		});
		const clearAllClips = async () => {
			const aliceClips = await alice.client.request('clips/list', {});
			for (const aliceClip of aliceClips) {
				//関係ないクリップは消しておく
				await alice.client.request('clips/delete', { clipId: aliceClip.id });
			}
		};
		test('見る用', async () => {
			const text = await (await fetch('https://a.test/users/' + alice.id, { headers: { Accept: 'application/activity+json' } })).text();
			strictEqual(text, 'DEBUG', text);
		});
		test('見る用2', async () => {
			await clearAllClips();
			const public_note = (await alice.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
			const new_clip = await alice.client.request('clips/create', { name: '見る用2', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: public_note.id });
			const json = await (await fetch('https://a.test/clips/' + new_clip.id, { headers: { Accept: 'application/activity+json' } })).json();
			json['@context'] = undefined;
			const text = JSON.stringify(json);
			strictEqual(text, 'DEBUG', text);
		});
		test('見る用3', async () => {
			await clearAllClips();
			const public_note = (await alice.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
			const new_clip = await alice.client.request('clips/create', { name: '見る用3', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: public_note.id });
			const json = await (await fetch('https://a.test/users/' + alice.id + '/collections/featuredCollections', { headers: { Accept: 'application/activity+json' } })).json();
			json['@context'] = undefined;
			const text = JSON.stringify(json);
			strictEqual(text, 'DEBUG', text);
		});
		test('見る用4', async () => {
			await clearAllClips();
			const public_note = (await alice.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
			const new_clip = await alice.client.request('clips/create', { name: '見る用4', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: public_note.id });
			const json = await (await fetch('https://a.test/users/' + alice.id + '/collections/featuredCollections?page=true', { headers: { Accept: 'application/activity+json' } })).json();
			json['@context'] = undefined;
			const text = JSON.stringify(json);
			strictEqual(text, 'DEBUG', text);
		});
		test('見る用5', async () => {
			await clearAllClips();
			const public_note = (await alice.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
			const new_clip = await alice.client.request('clips/create', { name: '見る用5', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: public_note.id });
			const json = await (await fetch('https://a.test/users/' + alice.id + '/collections/featuredCollections?page=true', { headers: { Accept: 'application/activity+json' } })).json();
			strictEqual(json.orderedItems[0], 'https://a.test/clips/' + new_clip.id);
		});
		test('見る用6', async () => {
			await clearAllClips();
			const public_note = (await alice.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
			const new_clip = await alice.client.request('clips/create', { name: '見る用6', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: public_note.id });
			const json = await (await fetch('https://a.test/clips/' + new_clip.id + '?page=true', { headers: { Accept: 'application/activity+json' } })).json();
			json['@context'] = undefined;
			const text = JSON.stringify(json);
			strictEqual(text, 'DEBUG', text);
		});
		test('公開クリップ公開ノートが連合する', async () => {
			await clearAllClips();
			const public_note = (await alice.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
			const home_note = (await alice.client.request('notes/create', { text: 'home note' + crypto.randomUUID().replaceAll('-', ''), visibility: 'home' })).createdNote;
			const new_clip = await alice.client.request('clips/create', { name: '公開クリップ公開ノートが連合する', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: public_note.id });
			await alice.client.request('clips/add-note', { clipId: new_clip.id, noteId: home_note.id });

			//lastClippedAtを更新するために一覧から取得する
			const clip = (await alice.client.request('users/clips', { userId: alice.id, remoteApi: false }))[0];
			await sleep();

			await bob.client.request('users/show', { userId: aliceInB.id });
			await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
			await sleep();
			await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			await sleep();
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			strictEqual(new Date(aliceInBClips[0].createdAt).getTime() - 1000 < new Date(clip.createdAt).getTime() + 1000, true);//多少の誤差が出る
			assert(aliceInBClips[0].lastClippedAt != null);
			assert(clip.lastClippedAt != null);
			strictEqual(new Date(aliceInBClips[0].lastClippedAt).getTime() - 1000 < new Date(clip.lastClippedAt).getTime() + 1000, true);//多少の誤差が出る
			strictEqual(aliceInBClips[0].userId, aliceInB.id);
			//非同期で取得されるから2回リクエスト飛ばす
			await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			await sleep();
			const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			strictEqual(notes.length, 2);
			strictEqual(notes[0].text, home_note.text);
			strictEqual(notes[1].text, public_note.text);
		});
		test('公開クリップ他人ノートが連合する', async () => {
			await clearAllClips();
			const bob_note = (await bob.client.request('notes/create', { text: 'public note' + crypto.randomUUID().replaceAll('-', '') })).createdNote;
			const clip = await alice.client.request('clips/create', { name: '公開クリップ他人ノートが連合する', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await sleep();
			const show_note = await alice.client.request('ap/show', { uri: `https://b.test/notes/${bob_note.id}` });
			await alice.client.request('clips/add-note', { clipId: clip.id, noteId: show_note.object.id });
			//ユーザー情報更新
			await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
			await sleep();
			await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			await sleep();
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			//非同期で取得されるから2回リクエスト飛ばす
			await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			await sleep();
			const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			strictEqual(notes.length, 1);
			strictEqual(notes[0].text, bob_note.text);
		});
		test('公開クリップ限定ノートが連合しない', async () => {
			await clearAllClips();
			const followers_note = (await alice.client.request('notes/create', { text: 'followers note' + crypto.randomUUID().replaceAll('-', ''), visibility: 'followers' })).createdNote;
			await sleep();
			const clip = await alice.client.request('clips/create', { name: '公開クリップ限定ノートが連合しない', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			await alice.client.request('clips/add-note', { clipId: clip.id, noteId: followers_note.id });
			//ユーザー情報更新
			await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
			await sleep();
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			//公開クリップがある
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			//非同期で取得されるから2回リクエスト飛ばす
			await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			await sleep();
			const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			//フォロワー限定ノートは見えない
			strictEqual(notes.length, 0);
		});
		test('公開クリップ限定ノートが連合する', async () => {
			await clearAllClips();
			await alice.client.request('following/create', { userId: bobInA.id });
			//フォロー処理待ち
			await sleep(800);
			const bob_note = (await bob.client.request('notes/create', { text: 'followers note' + crypto.randomUUID().replaceAll('-', ''), visibility: 'followers' })).createdNote;
			//ノート配送待ち
			await sleep();
			const user_notes = await alice.client.request('users/notes', { userId: bobInA.id });
			//フォロワーに配送来てるはず
			const bob_noteInA = user_notes[0];
			strictEqual(bob_noteInA.text, bob_note.text);
			const clip = await alice.client.request('clips/create', { name: '公開クリップ限定ノートが連合する', description: 'description', isPublic: true });
			await alice.client.request('clips/add-note', { clipId: clip.id, noteId: bob_noteInA.id });
			//ユーザー情報更新
			await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
			await sleep();
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			//非同期で取得されるから2回リクエスト飛ばす
			await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			await sleep();
			const notes = await bob.client.request('clips/notes', { clipId: aliceInBClips[0].id });
			strictEqual(notes.length, 1);
			strictEqual(notes[0].text, bob_note.text);
		});
		test('非公開クリップが連合しない', async () => {
			await clearAllClips();
			await alice.client.request('clips/create', { name: 'private', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: false });
			const clip = await alice.client.request('clips/create', { name: 'public', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			//ユーザー情報更新
			await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
			await sleep();
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			//0件にするとリモートAPI呼び出しが発生してキャッシュ由来の変な値になる
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
		});
		test('名前と説明文が更新できる', async () => {
			await clearAllClips();
			const clip = await alice.client.request('clips/create', { name: '更新前', description: 'description' + crypto.randomUUID().replaceAll('-', ''), isPublic: true });
			//ユーザー情報更新
			await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
			await sleep();
			const aliceInBClips = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips.length, 1);
			strictEqual(aliceInBClips[0].name, clip.name);
			strictEqual(aliceInBClips[0].description, clip.description);
			const clip2 = await alice.client.request('clips/update', { clipId: clip.id, name: '更新後', description: 'description' + crypto.randomUUID().replaceAll('-', '') });
			//ユーザー情報更新
			await bob.client.request('federation/update-remote-user', { userId: aliceInB.id });
			await sleep();
			const aliceInBClips2 = await bob.client.request('users/clips', { userId: aliceInB.id, remoteApi: false });
			strictEqual(aliceInBClips2.length, 1);
			strictEqual(aliceInBClips2[0].name, clip2.name);
			strictEqual(aliceInBClips2[0].description, clip2.description);
		});
	});

	describe('Follow / Unfollow', () => {
		let alice: LoginUser, bob: LoginUser;
		let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;

		beforeAll(async () => {
			[alice, bob] = await Promise.all([
				createAccount('a.test'),
				createAccount('b.test'),
			]);

			[bobInA, aliceInB] = await Promise.all([
				resolveRemoteUser('b.test', bob.id, alice),
				resolveRemoteUser('a.test', alice.id, bob),
			]);
		});

		describe('Follow a.test ==> b.test', () => {
			beforeAll(async () => {
				await alice.client.request('following/create', { userId: bobInA.id });

				await sleep();
			});

			test('Check consistency with `users/following` and `users/followers` endpoints', async () => {
				await Promise.all([
					strictEqual(
						(await alice.client.request('users/following', { userId: alice.id }))
							.some(v => v.followeeId === bobInA.id),
						true,
					),
					strictEqual(
						(await bob.client.request('users/followers', { userId: bob.id }))
							.some(v => v.followerId === aliceInB.id),
						true,
					),
				]);
			});
		});

		describe('Unfollow a.test ==> b.test', () => {
			beforeAll(async () => {
				await alice.client.request('following/delete', { userId: bobInA.id });

				await sleep();
			});

			test('Check consistency with `users/following` and `users/followers` endpoints', async () => {
				await Promise.all([
					strictEqual(
						(await alice.client.request('users/following', { userId: alice.id }))
							.some(v => v.followeeId === bobInA.id),
						false,
					),
					strictEqual(
						(await bob.client.request('users/followers', { userId: bob.id }))
							.some(v => v.followerId === aliceInB.id),
						false,
					),
				]);
			});
		});
	});

	describe('Follow requests', () => {
		let alice: LoginUser, bob: LoginUser;
		let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;

		beforeAll(async () => {
			[alice, bob] = await Promise.all([
				createAccount('a.test'),
				createAccount('b.test'),
			]);

			[bobInA, aliceInB] = await Promise.all([
				resolveRemoteUser('b.test', bob.id, alice),
				resolveRemoteUser('a.test', alice.id, bob),
			]);

			await alice.client.request('i/update', { isLocked: true });
		});

		describe('Send follow request from Bob to Alice and cancel', () => {
			describe('Bob sends follow request to Alice', () => {
				beforeAll(async () => {
					await bob.client.request('following/create', { userId: aliceInB.id });
					await sleep();
				});

				test('Alice should have a request', async () => {
					const requests = await alice.client.request('following/requests/list', {});
					strictEqual(requests.length, 1);
					strictEqual(requests[0].followee.id, alice.id);
					strictEqual(requests[0].follower.id, bobInA.id);
				});
			});

			describe('Alice cancels it', () => {
				beforeAll(async () => {
					await bob.client.request('following/requests/cancel', { userId: aliceInB.id });
					await sleep();
				});

				test('Alice should have no requests', async () => {
					const requests = await alice.client.request('following/requests/list', {});
					strictEqual(requests.length, 0);
				});
			});
		});

		describe('Send follow request from Bob to Alice and reject', () => {
			beforeAll(async () => {
				await bob.client.request('following/create', { userId: aliceInB.id });
				await sleep();

				await alice.client.request('following/requests/reject', { userId: bobInA.id });
				await sleep();
			});

			test('Bob should have no requests', async () => {
				await rejects(
					async () => await bob.client.request('following/requests/cancel', { userId: aliceInB.id }),
					(err: any) => {
						strictEqual(err.code, 'FOLLOW_REQUEST_NOT_FOUND');
						return true;
					},
				);
			});

			test('Bob doesn\'t follow Alice', async () => {
				const following = await bob.client.request('users/following', { userId: bob.id });
				strictEqual(following.length, 0);
			});
		});

		describe('Send follow request from Bob to Alice and accept', () => {
			beforeAll(async () => {
				await bob.client.request('following/create', { userId: aliceInB.id });
				await sleep();

				await alice.client.request('following/requests/accept', { userId: bobInA.id });
				await sleep();
			});

			test('Bob follows Alice', async () => {
				const following = await bob.client.request('users/following', { userId: bob.id });
				strictEqual(following.length, 1);
				strictEqual(following[0].followeeId, aliceInB.id);
				strictEqual(following[0].followerId, bob.id);
			});
		});
	});

	describe('Deletion', () => {
		describe('Check Delete consistency', () => {
			let alice: LoginUser, bob: LoginUser;
			let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);

				[bobInA, aliceInB] = await Promise.all([
					resolveRemoteUser('b.test', bob.id, alice),
					resolveRemoteUser('a.test', alice.id, bob),
				]);
			});

			test('Bob follows Alice, and Alice deleted themself', async () => {
				await bob.client.request('following/create', { userId: aliceInB.id });
				await sleep();

				const followers = await alice.client.request('users/followers', { userId: alice.id });
				strictEqual(followers.length, 1); // followed by Bob

				await alice.client.request('i/delete-account', { password: alice.password });
				await sleep();

				const following = await bob.client.request('users/following', { userId: bob.id });
				strictEqual(following.length, 0); // no following relation

				await rejects(
					async () => await bob.client.request('following/create', { userId: aliceInB.id }),
					(err: any) => {
						strictEqual(err.code, 'NO_SUCH_USER');
						return true;
					},
				);
			});
		});

		describe('Deletion of remote user for moderation', () => {
			let alice: LoginUser, bob: LoginUser;
			let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);

				[bobInA, aliceInB] = await Promise.all([
					resolveRemoteUser('b.test', bob.id, alice),
					resolveRemoteUser('a.test', alice.id, bob),
				]);
			});

			test('Bob follows Alice, then Alice gets deleted in B server', async () => {
				await bob.client.request('following/create', { userId: aliceInB.id });
				await sleep();

				const followers = await alice.client.request('users/followers', { userId: alice.id });
				strictEqual(followers.length, 1); // followed by Bob

				await bAdmin.client.request('admin/delete-account', { userId: aliceInB.id });
				await sleep();

				/**
				 * FIXME: remote account is not deleted!
				 *        @see https://github.com/misskey-dev/misskey/issues/14728
				 */
				const deletedAlice = await bob.client.request('users/show', { userId: aliceInB.id });
				assert(deletedAlice.id, aliceInB.id);

				// TODO: why still following relation?
				const following = await bob.client.request('users/following', { userId: bob.id });
				strictEqual(following.length, 1);
				await rejects(
					async () => await bob.client.request('following/create', { userId: aliceInB.id }),
					(err: any) => {
						strictEqual(err.code, 'ALREADY_FOLLOWING');
						return true;
					},
				);
			});

			test('Alice tries to follow Bob, but it is not processed', async () => {
				await alice.client.request('following/create', { userId: bobInA.id });
				await sleep();

				const following = await alice.client.request('users/following', { userId: alice.id });
				strictEqual(following.length, 0); // Not following Bob because B server doesn't return Accept

				const followers = await bob.client.request('users/followers', { userId: bob.id });
				strictEqual(followers.length, 0); // Alice's Follow is not processed
			});
		});
	});

	describe('Suspension', () => {
		describe('Check suspend/unsuspend consistency', () => {
			let alice: LoginUser, bob: LoginUser;
			let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);

				[bobInA, aliceInB] = await Promise.all([
					resolveRemoteUser('b.test', bob.id, alice),
					resolveRemoteUser('a.test', alice.id, bob),
				]);
			});

			test('Bob follows Alice, and Alice gets suspended, there is no following relation, and Bob fails to follow again', async () => {
				await bob.client.request('following/create', { userId: aliceInB.id });
				await sleep();

				const followers = await alice.client.request('users/followers', { userId: alice.id });
				strictEqual(followers.length, 1); // followed by Bob

				await aAdmin.client.request('admin/suspend-user', { userId: alice.id });
				await sleep();

				const following = await bob.client.request('users/following', { userId: bob.id });
				strictEqual(following.length, 0); // no following relation

				await rejects(
					async () => await bob.client.request('following/create', { userId: aliceInB.id }),
					(err: any) => {
						strictEqual(err.code, 'NO_SUCH_USER');
						return true;
					},
				);
			});

			test('Alice gets unsuspended, Bob succeeds in following Alice', async () => {
				await aAdmin.client.request('admin/unsuspend-user', { userId: alice.id });
				await sleep();

				const followers = await alice.client.request('users/followers', { userId: alice.id });
				strictEqual(followers.length, 1); // FIXME: followers are not deleted??

				/**
				 * FIXME: still rejected!
				 *        seems to can't process Undo Delete activity because it is not implemented
				 *        related @see https://github.com/misskey-dev/misskey/issues/13273
				 */
				await rejects(
					async () => await bob.client.request('following/create', { userId: aliceInB.id }),
					(err: any) => {
						strictEqual(err.code, 'NO_SUCH_USER');
						return true;
					},
				);

				// FIXME: resolving also fails
				await rejects(
					async () => await resolveRemoteUser('a.test', alice.id, bob),
					(err: any) => {
						strictEqual(err.code, 'INTERNAL_ERROR');
						return true;
					},
				);
			});

			/**
			 * instead of simple unsuspension, let's tell existence by following from Alice
			 */
			test('Alice can follow Bob', async () => {
				await alice.client.request('following/create', { userId: bobInA.id });
				await sleep();

				const bobFollowers = await bob.client.request('users/followers', { userId: bob.id });
				strictEqual(bobFollowers.length, 1); // followed by Alice
				assert(bobFollowers[0].follower != null);
				const renewedaliceInB = bobFollowers[0].follower;
				assert(aliceInB.username === renewedaliceInB.username);
				assert(aliceInB.host === renewedaliceInB.host);
				assert(aliceInB.id !== renewedaliceInB.id); // TODO: Same username and host, but their ids are different! Is it OK?

				const following = await bob.client.request('users/following', { userId: bob.id });
				strictEqual(following.length, 0); // following are deleted

				// Bob tries to follow Alice
				await bob.client.request('following/create', { userId: renewedaliceInB.id });
				await sleep();

				const aliceFollowers = await alice.client.request('users/followers', { userId: alice.id });
				strictEqual(aliceFollowers.length, 1);

				// FIXME: but resolving still fails ...
				await rejects(
					async () => await resolveRemoteUser('a.test', alice.id, bob),
					(err: any) => {
						strictEqual(err.code, 'INTERNAL_ERROR');
						return true;
					},
				);
			});
		});
	});
});
