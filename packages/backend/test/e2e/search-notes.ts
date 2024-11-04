/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { text } from 'body-parser';
import { api, post, signup, uploadUrl } from '../utils.js';
import type * as misskey from 'cherrypick-js';
import { query } from '@/misc/prelude/url.js';

describe('検索', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;
	let carol: misskey.entities.SignupResponse;
	let dave: misskey.entities.SignupResponse;
	let tom: misskey.entities.SignupResponse;
	let root: misskey.entities.SignupResponse;
	let aliceBlocking: misskey.entities.SignupResponse;
	let aliceMuting: misskey.entities.SignupResponse;
	let sensitiveFile0_1Note: misskey.entities.Note;
	let sensitiveFile1_2Note: misskey.entities.Note;
	let sensitiveFile2_2Note: misskey.entities.Note;
	let sensitive1Id: string;
	let sensitive2Id: string;
	let file_Attached: misskey.entities.Note;
	let nofile_Attached: misskey.entities.Note;
	let daveNote: misskey.entities.Note;
	let daveNoteDirect: misskey.entities.Note;
	let tomNote: misskey.entities.Note;
	let tomNoteDirect: misskey.entities.Note;
	let reactedNote: misskey.entities.Note;
	let votedNote: misskey.entities.Note;
	let clipedNote: misskey.entities.Note;
	let favoritedNote: misskey.entities.Note;
	let renotedNote: misskey.entities.Note;
	let replyedNote: misskey.entities.Note;
	let mutingNote: misskey.entities.Note;
	let blockingNote: misskey.entities.Note;
	let noteSearchableByNull: misskey.entities.Note;
	let noteSearchableByPublic: misskey.entities.Note;
	let noteSearchableByFollowersAndReacted: misskey.entities.Note;
	let noteSearchableByReacted: misskey.entities.Note;
	let noteSearchableByPrivate: misskey.entities.Note;

	beforeAll(async () => {
		root = await signup({ username: 'root' });
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		carol = await signup({ username: 'carol' });
		dave = await signup({ username: 'dave' });
		tom = await signup({ username: 'tom' });

		aliceBlocking = await signup({ username: 'aliceBlocking' });
		aliceMuting = await signup({ username: 'aliceMuting' });
		await api('blocking/create', { userId: alice.id }, aliceBlocking);
		await api('mute/create', { userId: aliceMuting.id }, alice);
		blockingNote = await post(aliceBlocking, { text: 'blocking' });
		mutingNote = await post(aliceMuting, { text: 'muting' });
		const sensitive1 = await uploadUrl(bob, 'https://raw.githubusercontent.com/yojo-art/cherrypick/develop/packages/backend/test/resources/192.jpg');
		const sensitive2 = await uploadUrl(bob, 'https://raw.githubusercontent.com/yojo-art/cherrypick/develop/packages/backend/test/resources/192.png');
		const notSensitive = await uploadUrl(bob, 'https://raw.githubusercontent.com/yojo-art/cherrypick/develop/packages/backend/test/resources/rotate.jpg');
		sensitive1Id = sensitive1.id;
		sensitive2Id = sensitive2.id;

		file_Attached = await post(bob, {
			text: 'filetest',
			fileIds: [notSensitive.id],
		});
		nofile_Attached = await post(bob, {
			text: 'filetest',
		});

		//ファイルへセンシティブフラグの付与
		const res1 = await	api('drive/files/update', {
			fileId: sensitive1Id,
			isSensitive: true,
		}, bob);
		assert.strictEqual(res1.status, 200);

		const res2 = await api('drive/files/update', {
			fileId: sensitive2Id,
			isSensitive: true,
		}, bob);
		assert.strictEqual(res2.status, 200);

		sensitiveFile0_1Note = await post(bob, {
			text: 'test_sensitive',
			fileIds: [notSensitive.id],
		});
		sensitiveFile1_2Note = await post(bob, {
			text: 'test_sensitive',
			fileIds: [sensitive1.id],
		});
		sensitiveFile2_2Note = await post(bob, {
			text: 'test_sensitive',
			fileIds: [sensitive1.id, sensitive2.id],
		});

		daveNote = await post(dave, { text: 'ff_test', visibility: 'followers' });
		daveNoteDirect = await post(dave, { text: 'ff_test', visibility: 'specified', visibleUserIds: [] });

		await api('following/create', { userId: tom.id }, alice);
		tomNote = await post(tom, { text: 'ff_test', visibility: 'followers' });
		tomNoteDirect = await post(tom, { text: '@alice ff_test', visibility: 'specified', visibleUserIds: [alice.id] });

		reactedNote = await post(carol, { text: 'indexable_text' });
		votedNote = await post(carol, {
			text: 'indexable_text',
			poll: {
				choices: ['1', '2'],
				multiple: false,
			},
		 });
		clipedNote = await post(carol, { text: 'indexable_text' });
		favoritedNote = await post(carol, { text: 'indexable_text' });
		renotedNote = await post(carol, { text: 'indexable_text' });
		replyedNote = await post(carol, { text: 'indexable_text' });

		console.log(JSON.stringify(reactedNote));

		noteSearchableByNull = await post(carol, { text: 'SearchableBy_Test', searchableBy: null });
		noteSearchableByPublic = await post(carol, { text: 'SearchableBy_Test', searchableBy: 'public' });
		noteSearchableByFollowersAndReacted = await post(carol, { text: 'SearchableBy_Test', searchableBy: 'followersAndReacted' });
		noteSearchableByReacted = await post(carol, { text: 'SearchableBy_Test', searchableBy: 'reactedOnly' });
		noteSearchableByPrivate = await post(carol, { text: 'SearchableBy_Test', searchableBy: 'private' });
		await new Promise(resolve => setTimeout(resolve, 5000));
	}, 1000 * 60 * 2);

	test('権限がないのでエラー', async () => {
		const res = await api('notes/advanced-search', {
			query: 'filetest',
		}, alice);

		assert.strictEqual(res.status, 400);
	});
	test('検索ロールへのアサイン', async() => {
		const roleres = await api('admin/roles/create', {
			name: 'test',
			description: '',
			color: null,
			iconUrl: null,
			displayOrder: 0,
			target: 'manual',
			condFormula: {},
			isAdministrator: false,
			isModerator: false,
			isPublic: false,
			isExplorable: false,
			asBadge: false,
			canEditMembersByModerator: false,
			policies: {
				canAdvancedSearchNotes: {
					useDefault: false,
					priority: 1,
					value: true,
				},
				canSearchNotes: {
					useDefault: false,
					priority: 1,
					value: true,
				},

			},
		}, root);

		assert.strictEqual(roleres.status, 200);

		await new Promise(x => setTimeout(x, 2));

		const assign = await api('admin/roles/assign', {
			userId: alice.id,
			roleId: roleres.body.id,
		}, root);
		assert.strictEqual(assign.status, 204);
		const assign2 = await api('admin/roles/assign', {
			userId: bob.id,
			roleId: roleres.body.id,
		}, root);
		assert.strictEqual(assign2.status, 204);
	});
	test('ファイルオプション:フィルタなし', async() => {
		const res = await api('notes/advanced-search', {
			query: 'filetest',
			fileOption: 'combined',
		}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 2);
	});
	test('ファイルオプション:ファイル付きのみ', async() => {
		const res = await api('notes/advanced-search', {
			query: 'filetest',
			fileOption: 'file-only',
		}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 1);

		const noteIds = res.body.map( x => x.id);

		assert.strictEqual(noteIds.includes(file_Attached.id), true);//添付ありがある
		assert.strictEqual(noteIds.includes(nofile_Attached.id), false);//添付なしがない
	});
	test('ファイルオプション:ファイルなしのみ', async() => {
		const res = await api('notes/advanced-search', {
			query: 'filetest',
			fileOption: 'no-file',
		}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 1);

		const noteIds = res.body.map( x => x.id);

		assert.strictEqual(noteIds.includes(nofile_Attached.id), true);//添付なしがある
		assert.strictEqual(noteIds.includes(file_Attached.id), false);//添付ありがない
	});
	test('センシティブオプション:フィルタなし', async() => {
		const res = await api('notes/advanced-search', {
			query: 'test_sensitive',
			sensitiveFilter: 'combined',
		}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 3);
	});
	test('可視性 followers, specified でてこない', async() => {
		const asres0 = await api('notes/advanced-search', {
			query: 'ff_test',
		}, bob);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);
		assert.strictEqual(asres0.body.length, 0);
	});
	test('可視性 followers, specified でてくる', async() => {
		const asres0 = await api('notes/advanced-search', {
			query: 'ff_test',
		}, alice);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);

		const ids = asres0.body.map((x) => x.id);
		assert.strictEqual(ids.includes(tomNote.id), true);
		assert.strictEqual(ids.includes(tomNoteDirect.id), true);
		assert.strictEqual(ids.includes(daveNote.id), false);
		assert.strictEqual(ids.includes(daveNoteDirect.id), false);
		assert.strictEqual(asres0.body.length, 2);
	});
	test('可視性 followers, specified indexable:falseでてこない', async() => {
		const ires = await api('i/update', {
			isIndexable: false,
		}, tom);
		assert.strictEqual(ires.status, 200);
		const ires2 = await api('i/update', {
			isIndexable: false,
		}, dave);
		assert.strictEqual(ires2.status, 200);

		const asres0 = await api('notes/advanced-search', {
			query: 'ff_test',
		}, bob);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);
		assert.strictEqual(asres0.body.length, 0);
	});
	test('可視性 followers, specified indexable:falseでてくる', async() => {
		const rres = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: tomNote.id,
		}, alice);
		assert.strictEqual(rres.status, 204);
		const rres2 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: tomNoteDirect.id,
		}, alice);
		assert.strictEqual(rres2.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));

		const asres0 = await api('notes/advanced-search', {
			query: 'ff_test',
		}, alice);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);
		assert.strictEqual(asres0.body.length, 2);

		const ids = asres0.body.map((x) => x.id);
		assert.strictEqual(ids.includes(tomNote.id), true);
		assert.strictEqual(ids.includes(tomNoteDirect.id), true);
		assert.strictEqual(ids.includes(daveNote.id), false);
		assert.strictEqual(ids.includes(daveNoteDirect.id), false);
		const ires = await api('i/update', {
			isIndexable: true,
		}, tom);
		assert.strictEqual(ires.status, 200);
		const ires2 = await api('i/update', {
			isIndexable: true,
		}, dave);
		assert.strictEqual(ires2.status, 200);
	});
	test('ミュートのノート普通に出る', async() => {
		const asres0 = await api('notes/advanced-search', {
			query: 'muting',
		}, bob);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);
		assert.strictEqual(asres0.body.length, 1);
		const asnids0 = asres0.body.map( x => x.id);
		assert.strictEqual(asnids0.includes(mutingNote.id), true);
	});
	test('ミュートしてたら出ない', async() => {
		const asres0 = await api('notes/advanced-search', {
			query: 'muting',
		}, alice);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);
		assert.strictEqual(asres0.body.length, 0);
	});
	test('ブロックのノート普通に出る', async() => {
		const asres0 = await api('notes/advanced-search', {
			query: 'blocking',
		}, bob);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);
		assert.strictEqual(asres0.body.length, 1);
		const asnids0 = asres0.body.map( x => x.id);
		assert.strictEqual(asnids0.includes(blockingNote.id), true);
	});
	test('ブロックされてたら出ない', async() => {
		const asres0 = await api('notes/advanced-search', {
			query: 'blocking',
		}, alice);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);
		assert.strictEqual(asres0.body.length, 0);
	});

	/*
	DB検索では未実装 別PRで出す
	test('センシティブオプション:含む', async() => {
		const res = await api('notes/advanced-search', {
			query: 'test_sensitive',
			sensitiveFilter: 'includeSensitive',
		}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 2);

		const noteIds = res.body.map( x => x.id);

		assert.strictEqual(noteIds.includes(sensitiveFile0_1Note.id), false);//センシティブなファイルがないノートがない
		//センシティブなファイルがあるノートがある
		assert.strictEqual(noteIds.includes(sensitiveFile1_2Note.id), true);
		assert.strictEqual(noteIds.includes(sensitiveFile2_2Note.id), true);
	});
	test('センシティブオプション:除外', async() => {
		const res = await api('notes/advanced-search', {
			query: 'test_sensitive',
			sensitiveFilter: 'withOutSensitive',
		}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 1);

		const noteIds = res.body.map( x => x.id);
		//センシティブなファイルがないノートがある
		assert.strictEqual(noteIds.includes(sensitiveFile0_1Note.id), true);
		//センシティブなファイルがあるノートがない
		assert.strictEqual(noteIds.includes(sensitiveFile1_2Note.id), false);
		assert.strictEqual(noteIds.includes(sensitiveFile2_2Note.id), false);
	});
	test('センシティブオプション:全センシティブ', async() => {
		const res = await api('notes/advanced-search', {
			query: 'test_sensitive',
			sensitiveFilter: 'withOutSensitive',
		}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.length, 1);

		const noteIds = res.body.map( x => x.id);
		//センシティブなファイルがないノートがない
		assert.strictEqual(noteIds.includes(sensitiveFile0_1Note.id), false);
		//センシティブなファイルを含むノートがない
		assert.strictEqual(noteIds.includes(sensitiveFile1_2Note.id), false);
		//センシティブなファイルのみなノートがある
		assert.strictEqual(noteIds.includes(sensitiveFile2_2Note.id), true);
	});
	*/
	test('indexable false ユーザーのノートは出てこない', async() => {
		const ires = await api('i/update', {
			isIndexable: false,
		}, carol);
		assert.strictEqual(ires.status, 200);
		const asres0 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres0.status, 200);
		assert.strictEqual(Array.isArray(asres0.body), true);
		assert.strictEqual(asres0.body.length, 0);
	});
	test('indexable false リアクションしたら出てくる', async() => {
		const rres = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: reactedNote.id,
		}, alice);
		assert.strictEqual(rres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
		const asres1 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres1.status, 200);
		assert.strictEqual(Array.isArray(asres1.body), true);
		assert.strictEqual(asres1.body.length, 1);

		const asnids1 = asres1.body.map( x => x.id);
		assert.strictEqual(asnids1.includes(reactedNote.id), true);
	});
	test('indexable false(通常検索) リアクションしたら出てくる', async() => {
		const sres1 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(sres1.status, 200);
		assert.strictEqual(Array.isArray(sres1.body), true);
		assert.strictEqual(sres1.body.length, 1);

		const snids1 = sres1.body.map( x => x.id);
		assert.strictEqual(snids1.includes(reactedNote.id), true);
	});
	let rnId: string;
	test('indexable false リノートしたら出てくる', async() => {
		const rnres = await api('notes/create', {
			renoteId: renotedNote.id,
		}, alice);
		await new Promise(resolve => setTimeout(resolve, 5000));
		assert.strictEqual(rnres.status, 200);
		rnId = rnres.body.createdNote.id;
		const asres2 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres2.status, 200);
		assert.strictEqual(Array.isArray(asres2.body), true);
		assert.strictEqual(asres2.body.length, 2);

		const asnids2 = asres2.body.map( x => x.id);
		assert.strictEqual(asnids2.includes(renotedNote.id), true);
	});
	test('indexable false(通常検索) リノートしたら出てくる', async() => {
		const sres2 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(sres2.status, 200);
		assert.strictEqual(Array.isArray(sres2.body), true);
		assert.strictEqual(sres2.body.length, 2);

		const snids2 = sres2.body.map( x => x.id);
		assert.strictEqual(snids2.includes(renotedNote.id), true);
	});
	let replyId: string;
	test('indexable false 返信したら出てくる', async() => {
		const rpres = await api('notes/create', {
			text: 'test',
			replyId: replyedNote.id,
		}, alice);
		assert.strictEqual(rpres.status, 200);
		replyId = rpres.body.createdNote.id;
		await new Promise(resolve => setTimeout(resolve, 5000));

		const asres3 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres3.status, 200);
		assert.strictEqual(Array.isArray(asres3.body), true);
		assert.strictEqual(asres3.body.length, 3);

		const asnids3 = asres3.body.map( x => x.id);
		assert.strictEqual(asnids3.includes(replyedNote.id), true);
	});
	test('indexable false(通常検索) 返信したら出てくる', async() => {
		const sres3 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(sres3.status, 200);
		assert.strictEqual(Array.isArray(sres3.body), true);
		assert.strictEqual(sres3.body.length, 3);

		const snids3 = sres3.body.map( x => x.id);
		assert.strictEqual(snids3.includes(replyedNote.id), true);
	});
	test('indexable false お気に入りしたら出てくる', async() => {
		const fvres = await api('notes/favorites/create', {
			noteId: favoritedNote.id,
		}, alice);
		assert.strictEqual(fvres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));

		const asres4 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres4.status, 200);
		assert.strictEqual(Array.isArray(asres4.body), true);
		assert.strictEqual(asres4.body.length, 4);

		const asnids4 = asres4.body.map( x => x.id);
		assert.strictEqual(asnids4.includes(favoritedNote.id), true);
	});
	test('indexable false(通常検索) お気に入りしたら出てくる', async() => {
		const sres4 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(sres4.status, 200);
		assert.strictEqual(Array.isArray(sres4.body), true);
		assert.strictEqual(sres4.body.length, 4);

		const snids4 = sres4.body.map( x => x.id);
		assert.strictEqual(snids4.includes(favoritedNote.id), true);
	});
	let clpId: string;
	test('indexable false クリップしたら出てくる', async() => {
		const clpres = await api('clips/create', {
			noteId: renotedNote.id,
			isPublic: false,
			name: 'test',
		}, alice);
		assert.strictEqual(clpres.status, 200);
		clpId = clpres.body.id;
		const clpaddres = await api('clips/add-note', {
			clipId: clpres.body.id,
			noteId: clipedNote.id,
		}, alice);
		assert.strictEqual(clpaddres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
		const asres5 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres5.status, 200);
		assert.strictEqual(Array.isArray(asres5.body), true);
		assert.strictEqual(asres5.body.length, 5);

		const asnids5 = asres5.body.map( x => x.id);
		assert.strictEqual(asnids5.includes(clipedNote.id), true);
	});
	test('indexable false(通常検索) クリップしたら出てくる', async() => {
		const sres5 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(sres5.status, 200);
		assert.strictEqual(Array.isArray(sres5.body), true);
		assert.strictEqual(sres5.body.length, 5);

		const snids5 = sres5.body.map( x => x.id);
		assert.strictEqual(snids5.includes(clipedNote.id), true);
	});
	test('indexable false 投票したら出てくる', async() => {
		const vres = await api('notes/polls/vote', {
			noteId: votedNote.id,
			choice: 0,
		}, alice);
		assert.strictEqual(vres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
		const asres6 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres6.status, 200);
		assert.strictEqual(Array.isArray(asres6.body), true);
		assert.strictEqual(asres6.body.length, 6);

		const asnids6 = asres6.body.map( x => x.id);
		assert.strictEqual(asnids6.includes(votedNote.id), true);
	});
	test('indexable false(通常検索) 投票したら出てくる', async() => {
		const asres6 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres6.status, 200);
		assert.strictEqual(Array.isArray(asres6.body), true);
		assert.strictEqual(asres6.body.length, 6);

		const asnids6 = asres6.body.map( x => x.id);
		assert.strictEqual(asnids6.includes(votedNote.id), true);
	});
	//
	test('indexable false リアクション外したらでない', async() => {
		const rres = await api('notes/reactions/delete', {
			noteId: reactedNote.id,
		}, alice);
		assert.strictEqual(rres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
		const asres1 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres1.status, 200);
		assert.strictEqual(Array.isArray(asres1.body), true);
		assert.strictEqual(asres1.body.length, 5);

		const asnids1 = asres1.body.map( x => x.id);
		assert.strictEqual(asnids1.includes(reactedNote.id), false);
	});
	test('indexable false(通常検索) リアクション外したらでない', async() => {
		const asres1 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres1.status, 200);
		assert.strictEqual(Array.isArray(asres1.body), true);
		assert.strictEqual(asres1.body.length, 5);

		const asnids1 = asres1.body.map( x => x.id);
		assert.strictEqual(asnids1.includes(reactedNote.id), false);
	});
	test('indexable false リノート消したらでない', async() => {
		const rnres = await api('notes/delete', {
			noteId: rnId,
		}, alice);
		assert.strictEqual(rnres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
		const asres2 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres2.status, 200);
		assert.strictEqual(Array.isArray(asres2.body), true);
		assert.strictEqual(asres2.body.length, 4);

		const asnids2 = asres2.body.map( x => x.id);
		assert.strictEqual(asnids2.includes(renotedNote.id), false);
	});
	test('indexable false(通常検索) リノート消したらでない', async() => {
		const asres2 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres2.status, 200);
		assert.strictEqual(Array.isArray(asres2.body), true);
		assert.strictEqual(asres2.body.length, 4);

		const asnids2 = asres2.body.map( x => x.id);
		assert.strictEqual(asnids2.includes(renotedNote.id), false);
	});
	test('indexable false リプライ消したらでない', async() => {
		const rnres = await api('notes/delete', {
			noteId: replyId,
		}, alice);
		assert.strictEqual(rnres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
		const asres2 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres2.status, 200);
		assert.strictEqual(Array.isArray(asres2.body), true);
		assert.strictEqual(asres2.body.length, 3);

		const asnids2 = asres2.body.map( x => x.id);
		assert.strictEqual(asnids2.includes(renotedNote.id), false);
	});
	test('indexable false(通常検索) リプライ消したらでない', async() => {
		const asres2 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres2.status, 200);
		assert.strictEqual(Array.isArray(asres2.body), true);
		assert.strictEqual(asres2.body.length, 3);

		const asnids2 = asres2.body.map( x => x.id);
		assert.strictEqual(asnids2.includes(renotedNote.id), false);
	});
	test('indexable false クリップ消したらでない', async() => {
		const clpaddres = await api('clips/remove-note', {
			clipId: clpId,
			noteId: clipedNote.id,
		}, alice);
		assert.strictEqual(clpaddres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
		const asres5 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres5.status, 200);
		assert.strictEqual(Array.isArray(asres5.body), true);
		assert.strictEqual(asres5.body.length, 2);

		const asnids5 = asres5.body.map( x => x.id);
		assert.strictEqual(asnids5.includes(clipedNote.id), false);
	});
	test('indexable false(通常検索) クリップ消したらでない', async() => {
		const asres5 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres5.status, 200);
		assert.strictEqual(Array.isArray(asres5.body), true);
		assert.strictEqual(asres5.body.length, 2);

		const asnids5 = asres5.body.map( x => x.id);
		assert.strictEqual(asnids5.includes(clipedNote.id), false);
	});
	test('indexable false お気に入り消したらでない', async() => {
		const fvres = await api('notes/favorites/delete', { noteId: favoritedNote.id }, alice);
		assert.strictEqual(fvres.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));

		const asres4 = await api('notes/advanced-search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres4.status, 200);
		assert.strictEqual(Array.isArray(asres4.body), true);
		assert.strictEqual(asres4.body.length, 1);

		const asnids4 = asres4.body.map( x => x.id);
		assert.strictEqual(asnids4.includes(favoritedNote.id), false);
	});
	test('indexable false(通常検索) お気に入り消したらでない', async() => {
		const asres4 = await api('notes/search', {
			query: 'indexable_text',
		}, alice);
		assert.strictEqual(asres4.status, 200);
		assert.strictEqual(Array.isArray(asres4.body), true);
		assert.strictEqual(asres4.body.length, 1);

		const asnids4 = asres4.body.map( x => x.id);
		assert.strictEqual(asnids4.includes(favoritedNote.id), false);
	});
	//投票は消せないので対象外

	//nullとpublicだけ出てくるはず
	test('searchableBy(note null,user: null, indexable true)', async () =>	{
		const ires = await api('i/update', {
			isIndexable: true,
		}, carol);
		assert.strictEqual(ires.status, 200);

		const res = await api('notes/advanced-search', {
			query: 'SearchableBy_Test',
		}, alice);
		assert.strictEqual(res.status, 200);

		const noteIds = res.body.map( x => x.id);
		assert.strictEqual(noteIds.includes(noteSearchableByNull.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByPublic.id), true);
		assert.strictEqual(noteIds.length, 2);
	});

	//publicだけ出てくる
	test('searchableBy(user: null, indexable false)', async () =>	{
		const ires = await api('i/update', {
			isIndexable: false,
		}, carol);
		assert.strictEqual(ires.status, 200);

		const res = await api('notes/advanced-search', {
			query: 'SearchableBy_Test',
		}, alice);
		assert.strictEqual(res.status, 200);

		const noteIds = res.body.map( x => x.id);
		assert.strictEqual(noteIds.includes(noteSearchableByNull.id), false);
		assert.strictEqual(noteIds.includes(noteSearchableByPublic.id), true);
		assert.strictEqual(noteIds.length, 1);
	});

	//色々出てくる
	test('searchableBy(user: null, indexable false)', async () =>	{
		const rres = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByPublic.id,
		}, alice);
		const rres2 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByReacted.id,
		}, alice);

		const rres3 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByFollowersAndReacted.id,
		}, alice);

		const rres4 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByPrivate.id,
		}, alice);

		const rres5 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByPrivate.id,
		}, alice);

		assert.strictEqual(rres.status, 204);
		assert.strictEqual(rres2.status, 204);
		assert.strictEqual(rres3.status, 204);
		assert.strictEqual(rres4.status, 204);
		assert.strictEqual(rres5.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));

		const res = await api('notes/advanced-search', {
			query: 'SearchableBy_Test',
		}, alice);
		assert.strictEqual(res.status, 200);

		const noteIds = res.body.map( x => x.id);
		assert.strictEqual(noteIds.includes(noteSearchableByNull.id), false);
		assert.strictEqual(noteIds.includes(noteSearchableByPrivate.id), false);
		assert.strictEqual(noteIds.includes(noteSearchableByPublic.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByFollowersAndReacted.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByReacted.id), true);
		assert.strictEqual(noteIds.length, 3);

		const rdres = await api('notes/reactions/delete', {
			noteId: noteSearchableByPublic.id,
		}, alice);
		const rdres2 = await api('notes/reactions/delete', {
			noteId: noteSearchableByFollowersAndReacted.id,
		}, alice);
		const rdres3 = await api('notes/reactions/delete', {
			noteId: noteSearchableByReacted.id,
		}, alice);
		const rdres4 = await api('notes/reactions/delete', {
			noteId: noteSearchableByPrivate.id,
		}, alice);
		const rdres5 = await api('notes/reactions/delete', {
			noteId: noteSearchableByNull.id,
		}, alice);

		assert.strictEqual(rdres.status, 204);
		assert.strictEqual(rdres2.status, 204);
		assert.strictEqual(rdres3.status, 204);
		assert.strictEqual(rdres4.status, 204);
		assert.strictEqual(rdres5.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
	});

	//nullとpublicだけ出てくる
	test('searchableBy(user: public, indexable false)', async () =>	{
		const ires = await api('i/update', {
			searchableBy: 'public',
		}, carol);
		assert.strictEqual(ires.status, 200);

		const res = await api('notes/advanced-search', {
			query: 'SearchableBy_Test',
		}, alice);
		assert.strictEqual(res.status, 200);

		const noteIds = res.body.map( x => x.id);
		assert.strictEqual(noteIds.includes(noteSearchableByNull.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByPublic.id), true);
		assert.strictEqual(noteIds.length, 2);
	});

	//nullとpublicだけ出てくる
	test('searchableBy(user: followersAndReacted, indexable false follow)', async () =>	{
		const ires = await api('i/update', {
			searchableBy: 'followersAndReacted',
		}, carol);
		assert.strictEqual(ires.status, 200);

		const fres = await api('following/create', {
			userId: carol.id,
		}, alice);
		assert.strictEqual(fres.status, 200);

		const res = await api('notes/advanced-search', {
			query: 'SearchableBy_Test',
		}, alice);
		assert.strictEqual(res.status, 200);

		const noteIds = res.body.map( x => x.id);
		assert.strictEqual(noteIds.includes(noteSearchableByNull.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByPublic.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByFollowersAndReacted.id), true);
		assert.strictEqual(noteIds.length, 3);
		assert.strictEqual(fres.status, 200);

		const fdres = await api('following/delete', {
			userId: carol.id,
		}, alice);
		assert.strictEqual(fdres.status, 200);
	});
	test('searchableBy(user: followersAndReacted, indexable false reaction)', async() => {
		const rres1 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByNull.id,
		}, alice);
		const rres2 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByReacted.id,
		}, alice);
		const rres3 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByFollowersAndReacted.id,
		}, alice);

		assert.strictEqual(rres1.status, 204);
		assert.strictEqual(rres2.status, 204);
		assert.strictEqual(rres3.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));

		const res = await api('notes/advanced-search', {
			query: 'SearchableBy_Test',
		}, alice);
		assert.strictEqual(res.status, 200);

		const noteIds = res.body.map( x => x.id);
		assert.strictEqual(noteIds.includes(noteSearchableByNull.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByPublic.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByFollowersAndReacted.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByReacted.id), true);
		assert.strictEqual(noteIds.length, 4);

		const rdres1 = await api('notes/reactions/delete', {
			noteId: noteSearchableByFollowersAndReacted.id,
		}, alice);
		const rdres2 = await api('notes/reactions/delete', {
			noteId: noteSearchableByReacted.id,
		}, alice);
		const rdres3 = await api('notes/reactions/delete', {
			noteId: noteSearchableByNull.id,
		}, alice);

		assert.strictEqual(rdres1.status, 204);
		assert.strictEqual(rdres2.status, 204);
		assert.strictEqual(rdres3.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
	});
	test('searchableBy(user: reactedOnly, indexable false)', async () =>	{
		const ires = await api('i/update', {
			searchableBy: 'reactedOnly',
		}, carol);
		assert.strictEqual(ires.status, 200);
		const rres1 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByNull.id,
		}, alice);
		const rres2 = await api('notes/reactions/create', {
			reaction: '❤',
			noteId: noteSearchableByReacted.id,
		}, alice);
		assert.strictEqual(rres1.status, 204);
		assert.strictEqual(rres2.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));

		const res = await api('notes/advanced-search', {
			query: 'SearchableBy_Test',
		}, alice);
		assert.strictEqual(res.status, 200);

		const noteIds = res.body.map( x => x.id);
		assert.strictEqual(noteIds.includes(noteSearchableByNull.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByPublic.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByReacted.id), true);
		assert.strictEqual(noteIds.length, 3);

		const rdres1 = await api('notes/reactions/delete', {
			noteId: noteSearchableByReacted.id,
		}, alice);
		const rdres2 = await api('notes/reactions/delete', {
			noteId: noteSearchableByNull.id,
		}, alice);
		assert.strictEqual(rdres1.status, 204);
		assert.strictEqual(rdres2.status, 204);
		await new Promise(resolve => setTimeout(resolve, 5000));
	});

	test('searchableBy(user: private, indexable false)', async () =>	{
		const ires = await api('i/update', {
			searchableBy: 'private',
		}, carol);
		assert.strictEqual(ires.status, 200);

		const res = await api('notes/advanced-search', {
			query: 'SearchableBy_Test',
		}, alice);
		assert.strictEqual(res.status, 200);

		const noteIds = res.body.map( x => x.id);
		assert.strictEqual(noteIds.includes(noteSearchableByNull.id), false);
		assert.strictEqual(noteIds.includes(noteSearchableByPublic.id), true);
		assert.strictEqual(noteIds.includes(noteSearchableByPrivate.id), false);
		assert.strictEqual(noteIds.length, 1);
	});
});
