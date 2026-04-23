/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { api, signup } from '../utils.js';
import type * as misskey from 'cherrypick-js';

describe('UserGroup', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;
	let carol: misskey.entities.SignupResponse;

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		carol = await signup({ username: 'carol' });
	}, 1000 * 60 * 2);

	describe('i/user-group-invites', () => {
		const bobGroups: any[] = [];

		beforeAll(async () => {
			for (let i = 0; i < 3; i++) {
				const g = await api('users/groups/create', { name: `bob-invite-group-${i}` }, bob);
				bobGroups.push(g.body);

				await api('users/groups/invite', {
					groupId: g.body.id,
					userId: alice.id,
				}, bob);
			}
		}, 1000 * 60 * 2);

		afterAll(async () => {
			for (const g of bobGroups) {
				await api('users/groups/delete', { groupId: g.id }, bob);
			}
		});

		test('自分宛ての招待一覧を取得できる', async () => {
			const res = await api('i/user-group-invites', {}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.length, 3);
			// 自分宛てのものだけが返ってくる
			assert.strictEqual(
				res.body.every(inv => bobGroups.some(g => g.id === inv.group.id)),
				true,
			);
		});

		test('他人宛ての招待は含まれない', async () => {
			// carolに対して別途招待を作っておく
			const carolTargetGroup = await api('users/groups/create', { name: 'carol-target-group' }, bob);
			await api('users/groups/invite', {
				groupId: carolTargetGroup.body.id,
				userId: carol.id,
			}, bob);

			// aliceの一覧にcarol宛てのものが混ざっていないことを確認
			const res = await api('i/user-group-invites', {}, alice);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(
				res.body.every(inv => inv.group.id !== carolTargetGroup.body.id),
				true,
			);

			// 後片付け
			await api('users/groups/delete', { groupId: carolTargetGroup.body.id }, bob);
		});

		test('limit で取得件数を制限できる', async () => {
			const res = await api('i/user-group-invites', { limit: 1 }, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.length, 1);
		});

		test('untilId でページング(古い方向へ)できる', async () => {
			// 全件取得して件数を確認
			const all = await api('i/user-group-invites', { limit: 100 }, alice);
			assert.strictEqual(all.status, 200);
			assert.strictEqual(all.body.length, 3);

			// 1ページ目
			const page1 = await api('i/user-group-invites', { limit: 1 }, alice);
			assert.strictEqual(page1.status, 200);
			assert.strictEqual(page1.body.length, 1);

			// 2ページ目
			const page2 = await api('i/user-group-invites', {
				limit: 1,
				untilId: page1.body[0].id,
			}, alice);
			assert.strictEqual(page2.status, 200);
			assert.strictEqual(page2.body.length, 1);
			assert.notStrictEqual(page1.body[0].id, page2.body[0].id);

			// 3ページ目
			const page3 = await api('i/user-group-invites', {
				limit: 1,
				untilId: page2.body[0].id,
			}, alice);
			assert.strictEqual(page3.status, 200);
			assert.strictEqual(page3.body.length, 1);
			assert.notStrictEqual(page2.body[0].id, page3.body[0].id);

			// 4ページ目は空
			const page4 = await api('i/user-group-invites', {
				limit: 1,
				untilId: page3.body[0].id,
			}, alice);
			assert.strictEqual(page4.status, 200);
			assert.strictEqual(page4.body.length, 0);
		});

		test('sinceId でページング(新しい方向へ)できる', async () => {
			const all = await api('i/user-group-invites', { limit: 100 }, alice);
			assert.strictEqual(all.body.length, 3);

			// 一番古いIDを起点に新しい方向へ
			const oldestId = all.body[all.body.length - 1].id;
			const res = await api('i/user-group-invites', {
				limit: 100,
				sinceId: oldestId,
			}, alice);

			assert.strictEqual(res.status, 200);
			// oldest 自身は含まれない
			assert.strictEqual(res.body.every(inv => inv.id !== oldestId), true);
			// 残り2件
			assert.strictEqual(res.body.length, 2);
		});

		test('承認した招待は一覧から消える', async () => {
			const before = await api('i/user-group-invites', { limit: 100 }, alice);
			assert.strictEqual(before.body.length >= 1, true);

			const target = before.body[0];
			const acceptRes = await api('users/groups/invitations/accept', { invitationId: target.id }, alice);
			assert.strictEqual(acceptRes.status, 200);

			const after = await api('i/user-group-invites', { limit: 100 }, alice);
			assert.strictEqual(after.body.every(inv => inv.id !== target.id), true);
			assert.strictEqual(after.body.length, before.body.length - 1);
		});

		test('拒否した招待は一覧から消える', async () => {
			const before = await api('i/user-group-invites', { limit: 100 }, alice);
			assert.strictEqual(before.body.length >= 1, true);

			const target = before.body[0];
			const rejectRes = await api('users/groups/invitations/reject', { invitationId: target.id }, alice);
			assert.strictEqual(rejectRes.status, 200);

			const after = await api('i/user-group-invites', { limit: 100 }, alice);
			assert.strictEqual(after.body.every(inv => inv.id !== target.id), true);
			assert.strictEqual(after.body.length, before.body.length - 1);
		});

		test('limit の境界値: 1 が指定できる', async () => {
			// bobが追加で招待を作って件数を確保
			const extra = await api('users/groups/create', { name: 'extra-boundary-group' }, bob);
			bobGroups.push(extra.body);
			await api('users/groups/invite', {
				groupId: extra.body.id,
				userId: alice.id,
			}, bob);

			const res = await api('i/user-group-invites', { limit: 1 }, alice);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.length, 1);
		});

		test('limit の境界値: 101 はバリデーションエラー', async () => {
			const res = await api('i/user-group-invites', { limit: 101 }, alice);
			assert.strictEqual(res.status, 400);
		});

		test('limit の境界値: 0 はバリデーションエラー', async () => {
			const res = await api('i/user-group-invites', { limit: 0 }, alice);
			assert.strictEqual(res.status, 400);
		});

		test('招待がないユーザーは空配列が返る', async () => {
			// carolにはこの時点で招待が残っていない想定
			const res = await api('i/user-group-invites', {}, carol);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.length, 0);
		});

		test('認証なしでは 401', async () => {
			const res = await api('i/user-group-invites', {});
			assert.strictEqual(res.status, 401);
		});
	});

	describe('users/groups/owned', () => {
		let aliceGroup1: any;
		let aliceGroup2: any;

		test('自分が作成したグループを削除できる', async () => {
			const aliceGroup = await api('users/groups/create', { name: 'alice-group' }, alice);

			const res1 = await api('users/groups/owned', {}, alice);
			assert.strictEqual(res1.status, 200);
			assert.strictEqual(Array.isArray(res1.body), true);
			assert.strictEqual(res1.body.length, 1);
			assert.strictEqual(res1.body.every(g => g.ownerId === alice.id), true);

			const res2 = await api('users/groups/delete', { groupId: aliceGroup.body.id }, alice);
			assert.strictEqual(res2.status, 204);

			const res3 = await api('users/groups/owned', {}, alice);
			assert.strictEqual(res3.status, 200);
			assert.strictEqual(Array.isArray(res3.body), true);
			assert.strictEqual(res3.body.length, 0);
			assert.strictEqual(res3.body.every(g => g.ownerId === alice.id), true);
		});

		test('他人が作成したグループは削除できない', async () => {
			const aliceGroup = await api('users/groups/create', { name: 'alice-group-2' }, alice);
			const res1 = await api('users/groups/owned', {}, alice);
			assert.strictEqual(res1.status, 200);
			assert.strictEqual(Array.isArray(res1.body), true);
			assert.strictEqual(res1.body.length, 1);
			assert.strictEqual(res1.body.every(g => g.ownerId === alice.id), true);

			const res2 = await api('users/groups/delete', { groupId: aliceGroup.body.id }, bob);
			assert.strictEqual(res2.status, 400);

			const res3 = await api('users/groups/owned', {}, alice);
			assert.strictEqual(res3.status, 200);
			assert.strictEqual(Array.isArray(res3.body), true);
			assert.strictEqual(res3.body.length, 1);
			assert.strictEqual(res3.body.every(g => g.ownerId === alice.id), true);

			const res4 = await api('users/groups/delete', { groupId: aliceGroup.body.id }, alice);
			assert.strictEqual(res4.status, 204);
		});

		test('自分が作成したグループ一覧を取得できる', async () => {
			aliceGroup1 = await api('users/groups/create', { name: 'my-group-1' }, alice);
			aliceGroup2 = await api('users/groups/create', { name: 'my-group-2' }, alice);

			const res = await api('users/groups/owned', {}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.length, 2);
			assert.strictEqual(res.body.every(g => g.ownerId === alice.id), true);
		});

		test('グループを作成していないユーザーは空配列が返る', async () => {
			const res = await api('users/groups/owned', {}, bob);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			// bobは自分のグループを作っていない(このテスト時点で)
			assert.strictEqual(res.body.length, 0);
		});

		test('他人が作成したグループは含まれない', async () => {
			// bobがグループを作り、aliceを招待・承認させる
			const bobGroup = await api('users/groups/create', { name: 'bob-group' }, bob);
			await api('users/groups/invite', {
				groupId: bobGroup.body.id,
				userId: alice.id,
			}, bob);

			const invitations = await api('i/user-group-invites', {}, alice);
			for (const inv of invitations.body) {
				await api('users/groups/invitations/accept', { invitationId: inv.id }, alice);
			}

			// aliceがownedを取得しても、bobGroupは含まれない
			const res1 = await api('users/groups/owned', { limit: 100 }, alice);

			assert.strictEqual(res1.status, 200);
			assert.strictEqual(
				res1.body.every(g => g.id !== bobGroup.body.id),
				true,
			);
			// 所有者は全員alice
			assert.strictEqual(res1.body.every(g => g.ownerId === alice.id), true);

			// bobのグループを削除
			const res2 = await api('users/groups/delete', { groupId: bobGroup.body.id }, bob);
			assert.strictEqual(res2.status, 204);
		});

		test('limit で取得件数を制限できる', async () => {
			const res = await api('users/groups/owned', { limit: 1 }, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.length, 1);
		});

		test('limit の境界値: 100 が指定できる', async () => {
			const res = await api('users/groups/owned', { limit: 100 }, alice);
			assert.strictEqual(res.status, 200);
			// 件数はその時点のデータに依存するため、上限を超えていないことのみ確認
			assert.strictEqual(res.body.length <= 100, true);
		});

		test('limit の境界値: 101 はバリデーションエラー', async () => {
			const res = await api('users/groups/owned', { limit: 101 }, alice);
			// 400 系のバリデーションエラーが返る想定
			assert.strictEqual(res.status, 400);
		});

		test('limit の境界値: 0 はバリデーションエラー', async () => {
			const res = await api('users/groups/owned', { limit: 0 }, alice);
			assert.strictEqual(res.status, 400);
		});

		test('untilId でページングできる', async () => {
			// 1ページ目
			const page1 = await api('users/groups/owned', { limit: 1 }, alice);
			assert.strictEqual(page1.body.length, 1);

			// 2ページ目
			const page2 = await api('users/groups/owned', {
				limit: 1,
				untilId: page1.body[0].id,
			}, alice);
			assert.strictEqual(page2.body.length, 1);

			// 別々のグループが返ってきている
			assert.notStrictEqual(page1.body[0].id, page2.body[0].id);

			// 3ページ目は空
			const page3 = await api('users/groups/owned', {
				limit: 1,
				untilId: page2.body[0].id,
			}, alice);
			assert.strictEqual(page3.body.length, 0);
		});

		test('sinceId でページングできる', async () => {
			const all = await api('users/groups/owned', { limit: 100 }, alice);
			assert.strictEqual(all.body.length, 2);

			const oldestId = all.body[all.body.length - 1].id;
			const res = await api('users/groups/owned', {
				limit: 1,
				sinceId: oldestId,
			}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.length, 1);
			assert.notStrictEqual(res.body[0].id, oldestId);
		});

		test('認証なしでは 401', async () => {
			const res = await api('users/groups/owned', {});
			assert.strictEqual(res.status, 401);
		});

		afterAll(async () => {
			await api('users/groups/delete', { groupId: aliceGroup1.body.id }, alice);
			await api('users/groups/delete', { groupId: aliceGroup2.body.id }, alice);
		});
	});

	describe('users/groups/joined', () => {
		let bobGroup: any;
		let carolGroup: any;
		test('自分が参加しているグループ一覧を取得できる', async () => {
			// bobとcarolがそれぞれグループを作成し、aliceを招待
			bobGroup = await api('users/groups/create', { name: 'group1' }, bob);
			carolGroup = await api('users/groups/create', { name: 'group2' }, carol);

			await api('users/groups/invite', {
				groupId: bobGroup.body.id,
				userId: alice.id,
			}, bob);
			await api('users/groups/invite', {
				groupId: carolGroup.body.id,
				userId: alice.id,
			}, carol);

			// aliceが招待を承認(エンドポイント名は実装に合わせて)
			const invitations = await api('i/user-group-invites', {}, alice);
			for (const inv of invitations.body) {
				await api('users/groups/invitations/accept', { invitationId: inv.id }, alice);
			}

			const res = await api('users/groups/joined', {}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.length, 2);
		});

		test('自分が作成したグループは含まれない', async () => {
			// aliceが自分でグループを作成
			await api('users/groups/create', { name: 'my-own-group' }, alice);

			const res = await api('users/groups/joined', {}, alice);

			assert.strictEqual(res.status, 200);
			// 自分が作ったグループは除外されるので、参加グループ数は変わらない
			assert.strictEqual(res.body.length, 2);
			assert.strictEqual(res.body.every(g => g.ownerId !== alice.id), true);
		});

		test('limit で取得件数を制限できる', async () => {
			const res = await api('users/groups/joined', { limit: 1 }, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.length, 1);
		});

		test('limit の境界値: 100 が指定できる', async () => {
			const res = await api('users/groups/joined', { limit: 100 }, alice);
			assert.strictEqual(res.status, 200);
			// 件数はその時点のデータに依存するため、上限を超えていないことのみ確認
			assert.strictEqual(res.body.length <= 100, true);
		});

		test('limit の境界値: 101 はバリデーションエラー', async () => {
			const res = await api('users/groups/joined', { limit: 101 }, alice);
			// 400 系のバリデーションエラーが返る想定
			assert.strictEqual(res.status, 400);
		});

		test('limit の境界値: 0 はバリデーションエラー', async () => {
			const res = await api('users/groups/joined', { limit: 0 }, alice);
			assert.strictEqual(res.status, 400);
		});

		test('グループから抜けると joined 一覧から消える', async () => {
			// carolが新たにグループを作り、aliceを招待・承認
			const leaveTestGroup = await api('users/groups/create', { name: 'leave-test-group' }, carol);
			await api('users/groups/invite', {
				groupId: leaveTestGroup.body.id,
				userId: alice.id,
			}, carol);
			const invitations = await api('i/user-group-invites', {}, alice);
			for (const inv of invitations.body) {
				await api('users/groups/invitations/accept', { invitationId: inv.id }, alice);
			}

			// 参加済みであることを確認
			const before = await api('users/groups/joined', { limit: 100 }, alice);
			assert.strictEqual(before.body.some(g => g.id === leaveTestGroup.body.id), true);

			// aliceがグループから抜ける
			const leaveRes = await api('users/groups/leave', { groupId: leaveTestGroup.body.id }, alice);
			assert.strictEqual(leaveRes.status, 204);

			// 一覧から消えていることを確認
			const after = await api('users/groups/joined', { limit: 100 }, alice);
			assert.strictEqual(after.body.every(g => g.id !== leaveTestGroup.body.id), true);

			// 後片付け
			await api('users/groups/delete', { groupId: leaveTestGroup.body.id }, carol);
		});

		test('招待を拒否したグループは joined 一覧に現れない', async () => {
			// bobが新たにグループを作り、aliceを招待
			const rejectTestGroup = await api('users/groups/create', { name: 'reject-test-group' }, bob);
			await api('users/groups/invite', {
				groupId: rejectTestGroup.body.id,
				userId: alice.id,
			}, bob);

			// aliceが拒否
			const invitations = await api('i/user-group-invites', {}, alice);
			const target = invitations.body.find(inv => inv.group.id === rejectTestGroup.body.id);
			assert.notStrictEqual(target, undefined);

			const rejectRes = await api('users/groups/invitations/reject', { invitationId: target!.id }, alice);
			assert.strictEqual(rejectRes.status, 200);

			// 一覧に現れないことを確認
			const res = await api('users/groups/joined', {}, alice);
			assert.strictEqual(res.body.every(g => g.id !== rejectTestGroup.body.id), true);

			// 後片付け
			await api('users/groups/delete', { groupId: rejectTestGroup.body.id }, bob);
		});

		test('untilId でページング(古い方向へ)できる', async () => {
			// 2つ取得できること
			const pages = await api('users/groups/joined', { limit: 100 }, alice);
			assert.strictEqual(pages.status, 200);
			assert.strictEqual(pages.body.length, 2);

			// 1ページ目
			const page1 = await api('users/groups/joined', { limit: 1 }, alice);
			assert.strictEqual(page1.status, 200);
			assert.strictEqual(page1.body.length, 1);

			// 2ページ目(untilIdで続きを取得)
			const page2 = await api('users/groups/joined', {
				limit: 1,
				untilId: page1.body[0].id,
			}, alice);
			assert.strictEqual(page2.status, 200);
			assert.strictEqual(page2.body.length, 1);

			// 別々のグループが返ってきているか
			assert.notStrictEqual(page1.body[0].id, page2.body[0].id);

			// 3ページ目は空(全2件しかないので)
			const page3 = await api('users/groups/joined', {
				limit: 1,
				untilId: page2.body[0].id,
			}, alice);
			assert.strictEqual(page3.status, 200);
			assert.strictEqual(page3.body.length, 0);
		});

		test('sinceId でページング(新しい方向へ)できる', async () => {
			// 全件取得して順序を確認
			const all = await api('users/groups/joined', { limit: 100 }, alice);
			assert.strictEqual(all.body.length, 2);

			// 一番古いIDを起点に新しい方向へ
			const oldestId = all.body[all.body.length - 1].id;
			const res = await api('users/groups/joined', {
				limit: 1,
				sinceId: oldestId,
			}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.length, 1);
			assert.notStrictEqual(res.body[0].id, oldestId);
		});

		test('自分が参加していないグループは含まれない', async () => {
			// carolが新しいグループを作るが、aliceは招待しない
			const secretGroup = await api('users/groups/create', { name: 'secret-group' }, carol);

			// bobを招待(aliceではない)
			await api('users/groups/invite', {
				groupId: secretGroup.body.id,
				userId: bob.id,
			}, carol);
			const bobInvitations = await api('i/user-group-invites', {}, bob);
			for (const inv of bobInvitations.body) {
				await api('users/groups/invitations/accept', { invitationId: inv.id }, bob);
			}

			// aliceが取得したグループ一覧に、secretGroupが含まれないことを確認
			const res = await api('users/groups/joined', { limit: 100 }, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(
				res.body.every(g => g.id !== secretGroup.body.id),
				true,
			);

			// secretGroupを削除する
			const delRes = await api('users/groups/delete', { groupId: secretGroup.body.id }, carol);
			assert.strictEqual(delRes.status, 204);
		});

		test('認証なしでは 401', async () => {
			const res = await api('users/groups/joined', {});
			assert.strictEqual(res.status, 401);
		});

		// お掃除
		afterAll(async () => {
			await api('users/groups/delete', { groupId: bobGroup.body.id }, bob);
			await api('users/groups/delete', { groupId: carolGroup.body.id }, carol);
		});
	});
});
