import assert, { deepStrictEqual, strictEqual } from 'assert';
import * as Misskey from 'cherrypick-js';
import { addCustomEmoji, createAccount, type LoginUser, resolveRemoteUser, sleep, createModerator, fetchAdmin } from './utils.js';

describe('Emoji', () => {
	let alice: LoginUser, bob: LoginUser;
	let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;
	let bAdmin: LoginUser;
	beforeAll(async () => {
		[alice, bob] = await Promise.all([
			createAccount('a.test'),
			createAccount('b.test'),
		]);

		[bobInA, aliceInB] = await Promise.all([
			resolveRemoteUser('b.test', bob.id, alice),
			resolveRemoteUser('a.test', alice.id, bob),
		]);
		await bob.client.request('following/create', { userId: aliceInB.id });
		bAdmin = await fetchAdmin('b.test');
		await sleep();
	});

	test('Custom emoji are delivered with Note delivery', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'allow',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);
		const remoteEmoji = await bob.client.request('emoji', { name: emoji.name, host: 'a.test' });
		deepStrictEqual(JSON.stringify({
			id: remoteEmoji.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: 'a.test',
			url: emoji.url,
			license: emoji.license,
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			copyPermission: emoji.copyPermission,
			usageInfo: emoji.usageInfo,
			author: emoji.author,
			description: emoji.description,
			isBasedOn: 'isBasedOn',
		}), JSON.stringify(remoteEmoji));
	});

	test('Custom emoji are delivered with Reaction delivery', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'allow',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
		});
		const note = (await alice.client.request('notes/create', { text: 'a' })).createdNote;
		await sleep();

		await alice.client.request('notes/reactions/create', { noteId: note.id, reaction: `:${emoji.name}:` });
		await sleep();

		const noteInB = (await bob.client.request('notes/timeline', {}))[0];
		deepStrictEqual(noteInB.reactions[`:${emoji.name}@a.test:`], 1);
		deepStrictEqual(noteInB.reactionEmojis[`${emoji.name}@a.test`], emoji.url);
		const remoteEmoji = await bob.client.request('emoji', { name: emoji.name, host: 'a.test' });
		deepStrictEqual(JSON.stringify({
			id: remoteEmoji.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: 'a.test',
			url: emoji.url,
			license: emoji.license,
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			copyPermission: emoji.copyPermission,
			usageInfo: emoji.usageInfo,
			author: emoji.author,
			description: emoji.description,
			isBasedOn: null,
		}), JSON.stringify(remoteEmoji));
	});

	test('Custom emoji are delivered with Profile delivery', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'allow',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
		});
		const renewedAlice = await alice.client.request('i/update', { name: `:${emoji.name}:` });
		await sleep();

		const renewedaliceInB = await bob.client.request('users/show', { userId: aliceInB.id });
		strictEqual(renewedaliceInB.name, renewedAlice.name);
		assert(emoji.name in renewedaliceInB.emojis);
		strictEqual(renewedaliceInB.emojis[emoji.name], emoji.url);
		const remoteEmoji = await bob.client.request('emoji', { name: emoji.name, host: 'a.test' });
		deepStrictEqual(JSON.stringify({
			id: remoteEmoji.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: 'a.test',
			url: emoji.url,
			license: emoji.license,
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			copyPermission: emoji.copyPermission,
			usageInfo: emoji.usageInfo,
			author: emoji.author,
			description: emoji.description,
			isBasedOn: null,
		}), JSON.stringify(remoteEmoji));
	});

	test('Local-only custom emoji aren\'t delivered with Note delivery', async () => {
		const emoji = await addCustomEmoji('a.test', { localOnly: true });
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		// deepStrictEqual(noteInB.emojis, {}); // TODO: this fails (why?)
		deepStrictEqual({ ...noteInB.emojis }, {});
	});

	test('Local-only custom emoji aren\'t delivered with Reaction delivery', async () => {
		const emoji = await addCustomEmoji('a.test', { localOnly: true });
		const note = (await alice.client.request('notes/create', { text: 'a' })).createdNote;
		await sleep();

		await alice.client.request('notes/reactions/create', { noteId: note.id, reaction: `:${emoji.name}:` });
		await sleep();

		const noteInB = (await bob.client.request('notes/timeline', {}))[0];
		deepStrictEqual({ ...noteInB.reactions }, { '❤': 1 });
		deepStrictEqual({ ...noteInB.reactionEmojis }, {});
	});

	test('Local-only custom emoji aren\'t delivered with Profile delivery', async () => {
		const emoji = await addCustomEmoji('a.test', { localOnly: true });
		const renewedAlice = await alice.client.request('i/update', { name: `:${emoji.name}:` });
		await sleep();

		const renewedaliceInB = await bob.client.request('users/show', { userId: aliceInB.id });
		strictEqual(renewedaliceInB.name, renewedAlice.name);
		deepStrictEqual({ ...renewedaliceInB.emojis }, {});
	});

	test('コピー拒否の絵文字をコピーできない(copy)', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'deny',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);

		// @ts-expect-error anyで警告が出るため
		const emojiId = (await bAdmin.client.request('admin/emoji/list-remote')).find( x => x.name === emoji.name).id;
		let res = await fetch(`https://b.test/api/admin/emoji/copy`, {
			method: 'POST',
			body: JSON.stringify({
				emojiId: emojiId,
				i: bAdmin.client.credential,
			}),
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'omit',
			cache: 'no-cache',
		});
		strictEqual((await res.json()).code, 'NOT_ALLOWED')
	});
	test('コピー拒否の絵文字をコピーできない(steal)', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'deny',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);
		let res = await fetch(`https://b.test/api/admin/emoji/steal`, {
			method: 'POST',
			body: JSON.stringify({
				name: emoji.name,
				host: 'a.test',
				i: bAdmin.client.credential,
			}),
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'omit',
			cache: 'no-cache',
		});
		strictEqual((await res.json()).code, 'NOT_ALLOWED')
	});

	test('コピー許可の絵文字をコピーできる(copy)', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'allow',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);
		// @ts-expect-error anyで警告が出るため
		const emojiId = (await bAdmin.client.request('admin/emoji/list-remote')).find( x => x.name === emoji.name).id;
		const res = await bAdmin.client.request('admin/emoji/copy', { emojiId: emojiId });
		strictEqual(JSON.stringify({
			id: res.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: null,
			url: res.url,
			license: emoji.license,
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			copyPermission: emoji.copyPermission,
			usageInfo: emoji.usageInfo,
			author: emoji.author,
			description: emoji.description,
			isBasedOn: 'isBasedOn',
		}), JSON.stringify(res));
	});
	test('コピー許可の絵文字をコピーできる(steal)', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'allow',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);
		const res = await bAdmin.client.request('admin/emoji/steal', { name: emoji.name, host: 'a.test' });
		strictEqual(JSON.stringify({
			id: res.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: null,
			url: res.url,
			license: emoji.license,
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			copyPermission: emoji.copyPermission,
			usageInfo: emoji.usageInfo,
			author: emoji.author,
			description: emoji.description,
			isBasedOn: 'isBasedOn',
		}), JSON.stringify(res));
	});

	test('条件付きの絵文字をコピーできない(copy)', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'conditional',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);

		// @ts-expect-error anyで警告が出るため
		const emojiId = (await bAdmin.client.request('admin/emoji/list-remote')).find( x => x.name === emoji.name).id;
		let res = await fetch(`https://b.test/api/admin/emoji/copy`, {
			method: 'POST',
			body: JSON.stringify({
				emojiId: emojiId,
				i: bAdmin.client.credential,
			}),
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'omit',
			cache: 'no-cache',
		});
		strictEqual((await res.json()).code, 'SEE_USAGEINFOMATION_OR_LICENSE')
	});
	test('条件付きの絵文字をコピーできない(steal)', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'conditional',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);
		let res = await fetch(`https://b.test/api/admin/emoji/steal`, {
			method: 'POST',
			body: JSON.stringify({
				name: emoji.name,
				host: 'a.test',
				i: bAdmin.client.credential,
			}),
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'omit',
			cache: 'no-cache',
		});
		strictEqual((await res.json()).code, 'SEE_USAGEINFOMATION_OR_LICENSE')
	});
	test('条件付きの絵文字をコピーできる(copy)', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'allow',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);
		// @ts-expect-error anyで警告が出るため
		const emojiId = (await bAdmin.client.request('admin/emoji/list-remote')).find( x => x.name === emoji.name).id;
		const res = await bAdmin.client.request('admin/emoji/copy', { emojiId: emojiId, usageInfoReaded: true });
		strictEqual(JSON.stringify({
			id: res.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: null,
			url: res.url,
			license: emoji.license,
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			copyPermission: emoji.copyPermission,
			usageInfo: emoji.usageInfo,
			author: emoji.author,
			description: emoji.description,
			isBasedOn: 'isBasedOn',
		}), JSON.stringify(res));
	});
	test('条件付きの絵文字をコピーできる(steal)', async () => {
		const emoji = await addCustomEmoji('a.test', {
			aliases: ['a', 'b', 'c'],
			license: 'license',
			category: 'category',
			copyPermission: 'allow',
			usageInfo: 'usageInfo',
			author: '@alice@a.test',
			description: 'description',
			isBasedOn: 'isBasedOn',
		});
		await alice.client.request('notes/create', { text: `I love :${emoji.name}:` });
		await sleep();

		const notes = await bob.client.request('notes/timeline', {});
		const noteInB = notes[0];

		strictEqual(noteInB.text, `I love \u200b:${emoji.name}:\u200b`);
		assert(noteInB.emojis != null);
		assert(emoji.name in noteInB.emojis);
		strictEqual(noteInB.emojis[emoji.name], emoji.url);
		const res = await bAdmin.client.request('admin/emoji/steal', { name: emoji.name, host: 'a.test', usageInfoReaded: true });
		strictEqual(JSON.stringify({
			id: res.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: null,
			url: res.url,
			license: emoji.license,
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			copyPermission: emoji.copyPermission,
			usageInfo: emoji.usageInfo,
			author: emoji.author,
			description: emoji.description,
			isBasedOn: 'isBasedOn',
		}), JSON.stringify(res));
	});

});
