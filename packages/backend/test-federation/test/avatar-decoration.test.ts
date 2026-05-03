import { deepStrictEqual, strictEqual } from 'node:assert';
import * as Misskey from 'cherrypick-js';
import { createAccount, fetchAdmin, type LoginUser, resolveRemoteUser, sleep } from './utils.js';

const [aAdmin, bAdmin, cAdmin] = await Promise.all([
	fetchAdmin('a.test'),
	fetchAdmin('b.test'),
	fetchAdmin('c.test'),
]);

/**
 * admin/avatar-decorations/list-remote のフェデレーションテスト
 *
 * シナリオ:
 *  - a.test, b.test, c.test の3ホスト構成
 *  - b.test に 1件、c.test に 2件のアバターデコレーションを作成し、それぞれのユーザーに装備
 *  - a.test から b.test / c.test のユーザーを resolve して伝播させる
 *  - a.test 上の admin が list-remote を叩いて、ホストフィルタ・ページネーションの正しさを確認
 *
 * NOTE: アバターデコレーションのフェデレーション伝搬は cherrypick 独自拡張に依存。
 * 実装が変わったら resolve のトリガを直すこと。
 */
describe('Avatar-Decorations', () => {
	let alice: LoginUser;
	let bob: LoginUser;
	let carol: LoginUser;

	let aDeco1: Misskey.entities.AdminAvatarDecorationsCreateResponse;
	let aDeco2: Misskey.entities.AdminAvatarDecorationsCreateResponse;
	let bDeco: Misskey.entities.AdminAvatarDecorationsCreateResponse;
	let cDeco1: Misskey.entities.AdminAvatarDecorationsCreateResponse;
	let cDeco2: Misskey.entities.AdminAvatarDecorationsCreateResponse;

	beforeAll(async () => {
		[alice, bob, carol] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
			createAccount('c.test'),
		]);

		await sleep();
		// c.testの最大アバターデコレーション数を2にする
		await cAdmin.client.request('admin/roles/update-default-policies', {
			policies: {
				avatarDecorationLimit: 2 as never,
			},
		});
		await sleep();

		// a.test にデコレーション2件
		aDeco1 = await aAdmin.client.request('admin/avatar-decorations/create', {
			name: `fed-test-deco-a-${Date.now()}`,
			description: '',
			url: 'https://a.test/files/dummy-decoration-a1.png',
			roleIdsThatCanBeUsedThisDecoration: [],
		});
		await sleep();

		aDeco2 = await aAdmin.client.request('admin/avatar-decorations/create', {
			name: `fed-test-deco-a-${Date.now()}`,
			description: '',
			url: 'https://a.test/files/dummy-decoration-a2.png',
			roleIdsThatCanBeUsedThisDecoration: [],
		});
		await sleep();

		// b.test にデコレーション1件
		bDeco = await bAdmin.client.request('admin/avatar-decorations/create', {
			name: `fed-test-deco-b-${Date.now()}`,
			description: '',
			url: 'https://b.test/files/dummy-decoration-b1.png',
			roleIdsThatCanBeUsedThisDecoration: [],
		});

		// c.test にデコレーション2件
		cDeco1 = await cAdmin.client.request('admin/avatar-decorations/create', {
			name: `fed-test-deco-c-${Date.now()}`,
			description: '',
			url: 'https://c.test/files/dummy-decoration-c1.png',
			roleIdsThatCanBeUsedThisDecoration: [],
		});
		await sleep();

		cDeco2 = await cAdmin.client.request('admin/avatar-decorations/create', {
			name: `fed-test-deco-c-${Date.now()}`,
			description: '',
			url: 'https://c.test/files/dummy-decoration-c2.png',
			roleIdsThatCanBeUsedThisDecoration: [],
		});
		await sleep();

		// 各ユーザーに装備
		await bob.client.request('i/update', {
			avatarDecorations: [{
				id: bDeco.id,
				url: bDeco.url,
				angle: 0,
				flipH: false,
				offsetX: 0,
				offsetY: 0,
				opacity: 1,
				scale: 1,
			}],
		});

		await carol.client.request('i/update', {
			avatarDecorations: [{
				id: cDeco1.id,
				url: cDeco1.url,
				angle: 0,
				flipH: false,
				offsetX: 0,
				offsetY: 0,
				opacity: 1,
				scale: 1,
			}, {
				id: cDeco2.id,
				url: cDeco2.url,
				angle: 0,
				flipH: false,
				offsetX: 0,
				offsetY: 0,
				opacity: 1,
				scale: 1,
			}],
		});
		await sleep();
	});

	describe('admin/avatar-decorations/list-remote (federation)', () => {
		test('各サーバーのローカルでアバターデコレーションが確認できること', async () => {
			const aList = await alice.client.request('get-avatar-decorations', {});
			strictEqual(aList.length, 2, JSON.stringify(aList));

			const bList = await bob.client.request('get-avatar-decorations', {});
			const bFound = bList.find(d => d.name === bDeco.name);

			strictEqual(bList.length, 1, JSON.stringify(bList));
			strictEqual(bFound !== undefined, true, JSON.stringify(bList));

			const cList = await carol.client.request('get-avatar-decorations', {});
			const cFound1 = cList.find(d => d.name === cDeco1.name);
			const cFound2 = cList.find(d => d.name === cDeco2.name);

			strictEqual(cList.length, 2, JSON.stringify(cList));
			strictEqual(cFound1 !== undefined, true, JSON.stringify(cList));
			strictEqual(cFound2 !== undefined, true, JSON.stringify(cList));
		});

		test('a.test でリモートのアバターデコレーションの取得に成功すること', async () => {
			// a.test から bob, carol を resolve
			const carolInAlice = await resolveRemoteUser('c.test', carol.id, alice);
			const bobInAlice = await resolveRemoteUser('b.test', bob.id, alice);
			// ちょっと待つ
			await sleep(1 * 1000);

			// resolveRemoteUserしてもデコレーションが来ない（？？？
			// なので、ApPersonServiceのupdatePersonを叩く
			await alice.client.request('federation/update-remote-user', { userId: bobInAlice.id });
			await alice.client.request('federation/update-remote-user', { userId: carolInAlice.id });
			// ちょっと待つ
			await sleep(1 * 1000);

			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', {});
			strictEqual(list.length, 3, JSON.stringify(list));
		});

		test('host 未指定で叩くと b.test と c.test 両方のデコレーションが見えること', async () => {
			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', {});

			// 全件 host 非 null（a.test 自身のローカルは含まれない）
			for (const d of list) {
				strictEqual(d.host !== null, true, JSON.stringify(d));
			}

			const fromB = list.find(d => d.name === bDeco.name && d.host === 'b.test');
			const fromC1 = list.find(d => d.name === cDeco1.name && d.host === 'c.test');
			const fromC2 = list.find(d => d.name === cDeco2.name && d.host === 'c.test');

			strictEqual(fromB !== undefined, true, `expected b.test decoration, got ${JSON.stringify(list)}`);
			strictEqual(fromC1 !== undefined, true, `expected c.test old decoration, got ${JSON.stringify(list)}`);
			strictEqual(fromC2 !== undefined, true, `expected c.test new decoration, got ${JSON.stringify(list)}`);
		});

		test('host="b.test" でフィルタすると b.test のものだけ取れる', async () => {
			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', { host: 'b.test' });

			for (const d of list) {
				strictEqual(d.host, 'b.test', JSON.stringify(d));
			}

			const found = list.find(d => d.name === bDeco.name);
			strictEqual(found !== undefined, true, JSON.stringify(list));

			// c.test のものが漏れていない
			strictEqual(list.find(d => d.name === cDeco1.name), undefined);
			strictEqual(list.find(d => d.name === cDeco2.name), undefined);
		});

		test('host="c.test" でフィルタすると c.test のものだけ取れる', async () => {
			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', { host: 'c.test' });

			for (const d of list) {
				strictEqual(d.host, 'c.test', JSON.stringify(d));
			}

			const oldFound = list.find(d => d.name === cDeco1.name);
			const newFound = list.find(d => d.name === cDeco2.name);
			strictEqual(oldFound !== undefined, true, JSON.stringify(list));
			strictEqual(newFound !== undefined, true, JSON.stringify(list));

			// b.test のものが漏れていない
			strictEqual(list.find(d => d.name === bDeco.name), undefined);
		});

		test('host="." を指定すると a.test のローカルのみが返り、リモートは漏れない', async () => {
			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', { host: '.' });

			for (const d of list) {
				strictEqual(d.host, null, JSON.stringify(d));
			}

			strictEqual(list.find(d => d.name === bDeco.name), undefined, 'b.test deco must not leak when host="."');
			strictEqual(list.find(d => d.name === cDeco1.name), undefined, 'c.test old deco must not leak when host="."');
			strictEqual(list.find(d => d.name === cDeco2.name), undefined, 'c.test new deco must not leak when host="."');
		});

		test('存在しないホストを指定すると空配列が返る', async () => {
			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', { host: 'nonexistent.invalid' });
			strictEqual(list.length, 0);
		});

		test('limit=1が正しく動作すること', async () => {
			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', { host: 'c.test' });
			strictEqual(list.length, 2, JSON.stringify(list));

			const limitList = await aAdmin.client.request('admin/avatar-decorations/list-remote', { host: 'c.test', limit: 1 });
			strictEqual(limitList.length, 1, JSON.stringify(limitList));
		});

		test('untilId に新しい方の ID を指定すると、それより古いもののみ返る', async () => {
			// c.test の新しい方の ID は a.test 上では別 ID で保存されている可能性があるので、
			// 一度全件取得して a.test 上の ID を引く
			const all = await aAdmin.client.request('admin/avatar-decorations/list-remote', { host: 'c.test', limit: 100 });
			const newOnA = all.find(d => d.name === cDeco2.name);
			const oldOnA = all.find(d => d.name === cDeco1.name);
			strictEqual(newOnA !== undefined, true, 'precondition: new decoration must be present');
			strictEqual(oldOnA !== undefined, true, 'precondition: old decoration must be present');
			if (!newOnA || !oldOnA) return;

			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', {
				host: 'c.test',
				untilId: newOnA.id,
				limit: 100,
			});

			// 新しい方は除外されている
			strictEqual(list.find(d => d.id === newOnA.id), undefined, 'new decoration must be excluded by untilId');
			// 古い方は残っている
			strictEqual(list.find(d => d.id === oldOnA.id) !== undefined, true, JSON.stringify(list));
		});

		test('sinceId に古い方の ID を指定すると、それより新しいもののみ返る', async () => {
			const all = await aAdmin.client.request('admin/avatar-decorations/list-remote', { host: 'c.test', limit: 100 });
			const newOnA = all.find(d => d.name === cDeco2.name);
			const oldOnA = all.find(d => d.name === cDeco1.name);
			strictEqual(newOnA !== undefined, true);
			strictEqual(oldOnA !== undefined, true);
			if (!newOnA || !oldOnA) return;

			const list = await aAdmin.client.request('admin/avatar-decorations/list-remote', {
				host: 'c.test',
				sinceId: oldOnA.id,
				limit: 100,
			});

			// 古い方は除外されている
			strictEqual(list.find(d => d.id === oldOnA.id), undefined, 'old decoration must be excluded by sinceId');
			// 新しい方は残っている
			strictEqual(list.find(d => d.id === newOnA.id) !== undefined, true, JSON.stringify(list));
		});

		test('一般ユーザーはアクセスできないこと', async () => {
			let errored = false;
			try {
				await alice.client.request('admin/avatar-decorations/list-remote', {});
			} catch (err) {
				errored = true;
				const e = err as { code?: string; status?: number };
				strictEqual(
					e.status === 403 || e.code === 'ROLE_PERMISSION_DENIED' || e.code === 'ACCESS_DENIED',
					true,
					`unexpected error: ${JSON.stringify(err)}`,
				);
			}
			strictEqual(errored, true, 'request should have been rejected');
		});
	});

	describe('admin/avatar-decorations/list (federation)', () => {
		test('limit=1が正しく動くこと', async () => {
			const list = await aAdmin.client.request('admin/avatar-decorations/list', { });
			strictEqual(list.length, 2, JSON.stringify(list));

			const limitList = await aAdmin.client.request('admin/avatar-decorations/list', { limit: 1 });
			strictEqual(limitList.length, 1, JSON.stringify(limitList));
		});

		test('untilId に新しい方の ID を指定すると、それより古いもののみ返る', async () => {
			const all = await aAdmin.client.request('admin/avatar-decorations/list', { limit: 100 });
			const newDeco = all.find(d => d.name === aDeco2.name);
			const oldDeco = all.find(d => d.name === aDeco1.name);
			strictEqual(newDeco !== undefined, true, 'precondition: new decoration must be present');
			strictEqual(oldDeco !== undefined, true, 'precondition: old decoration must be present');
			if (!newDeco || !oldDeco) return;

			const list = await aAdmin.client.request('admin/avatar-decorations/list', {
				untilId: newDeco.id,
				limit: 100,
			});

			// 新しい方は除外されている
			strictEqual(list.find(d => d.id === newDeco.id), undefined, 'new decoration must be excluded by untilId');
			// 古い方は残っている
			strictEqual(list.find(d => d.id === oldDeco.id) !== undefined, true, JSON.stringify(list));
		});

		test('sinceId に古い方の ID を指定すると、それより新しいもののみ返る', async () => {
			const all = await aAdmin.client.request('admin/avatar-decorations/list', { limit: 100 });
			const newDeco = all.find(d => d.name === aDeco2.name);
			const oldDeco = all.find(d => d.name === aDeco1.name);
			strictEqual(newDeco !== undefined, true);
			strictEqual(oldDeco !== undefined, true);
			if (!newDeco || !oldDeco) return;

			const list = await aAdmin.client.request('admin/avatar-decorations/list', {
				sinceId: oldDeco.id,
				limit: 100,
			});

			// 古い方は除外されている
			strictEqual(list.find(d => d.id === oldDeco.id), undefined, 'old decoration must be excluded by sinceId');
			// 新しい方は残っている
			strictEqual(list.find(d => d.id === newDeco.id) !== undefined, true, JSON.stringify(list));
		});

		test('一般ユーザーはアクセスできないこと', async () => {
			let errored = false;
			try {
				await alice.client.request('admin/avatar-decorations/list', {});
			} catch (err) {
				errored = true;
				const e = err as { code?: string; status?: number };
				strictEqual(
					e.status === 403 || e.code === 'ROLE_PERMISSION_DENIED' || e.code === 'ACCESS_DENIED',
					true,
					`unexpected error: ${JSON.stringify(err)}`,
				);
			}
			strictEqual(errored, true, 'request should have been rejected');
		});
	});
});
