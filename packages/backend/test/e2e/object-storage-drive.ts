/*
 * SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, test, vi } from 'vitest';
import {
	CreateBucketCommand,
	ListObjectsV2Command,
	PutBucketPolicyCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { api, signup, startJobQueue, uploadFile } from '../utils.js';
import { describeObjectStorageE2E } from '../helpers/describe-object-storage-e2e.js';
import type { INestApplicationContext } from '@nestjs/common';
import type * as misskey from 'misskey-js';

// ローカルで起動した rustfs (packages/backend/test/compose.yml 参照) に接続する
const OBJECT_STORAGE_ENDPOINT = process.env.OBJECT_STORAGE_ENDPOINT ?? 'http://127.0.0.1:59312';
const OBJECT_STORAGE_BUCKET = process.env.OBJECT_STORAGE_BUCKET ?? 'misskey-test';
const OBJECT_STORAGE_ACCESS_KEY = process.env.OBJECT_STORAGE_ACCESS_KEY ?? 'rustfsadmin';
const OBJECT_STORAGE_SECRET_KEY = process.env.OBJECT_STORAGE_SECRET_KEY ?? 'rustfsadmin';

describeObjectStorageE2E('オブジェクトストレージ', () => {
	let queue: INestApplicationContext;
	let root: misskey.entities.SignupResponse;
	let s3Client: S3Client;

	beforeAll(async () => {
		queue = await startJobQueue();
		root = await signup({ username: 'root' });

		s3Client = new S3Client({
			endpoint: OBJECT_STORAGE_ENDPOINT,
			region: 'us-east-1',
			credentials: {
				accessKeyId: OBJECT_STORAGE_ACCESS_KEY,
				secretAccessKey: OBJECT_STORAGE_SECRET_KEY,
			},
			forcePathStyle: true,
		});

		try {
			await s3Client.send(new CreateBucketCommand({
				Bucket: OBJECT_STORAGE_BUCKET,
			}));
		} catch (err: any) {
			// 既にバケットが存在する場合は問題ない
			if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(err?.name)) {
				throw err;
			}
		}

		// Misskeyは生成したURLへ匿名アクセスするため、バケットを公開読み取り可能にしておく
		await s3Client.send(new PutBucketPolicyCommand({
			Bucket: OBJECT_STORAGE_BUCKET,
			Policy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [{
					Sid: 'PublicReadGetObject',
					Effect: 'Allow',
					Principal: { AWS: ['*'] },
					Action: ['s3:GetObject'],
					Resource: [`arn:aws:s3:::${OBJECT_STORAGE_BUCKET}/*`],
				}],
			}),
		}));

		// S3Serviceはエンドポイント文字列をそのまま使うため <host>:<port> 形式にする
		// (objectStoragePort は公開URL構築用のレガシー項目でS3クライアントには反映されない)
		const storageUrl = new URL(OBJECT_STORAGE_ENDPOINT);

		await api('admin/update-meta', {
			useObjectStorage: true,
			objectStorageBaseUrl: null,
			objectStorageEndpoint: storageUrl.host,
			objectStoragePort: null,
			objectStorageUseSSL: storageUrl.protocol === 'https:',
			objectStorageBucket: OBJECT_STORAGE_BUCKET,
			objectStoragePrefix: 'test',
			objectStorageAccessKey: OBJECT_STORAGE_ACCESS_KEY,
			objectStorageSecretKey: OBJECT_STORAGE_SECRET_KEY,
			objectStorageRegion: 'us-east-1',
			objectStorageS3ForcePathStyle: true,
			objectStorageSetPublicRead: false, // rustfsはACL非対応
			objectStorageUseProxy: false,
		}, root);
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await queue?.close();
	});

	test('アップロードしたファイルがオブジェクトストレージへ保存され、URLから取得できる', async () => {
		const upRes = await uploadFile(root, { path: '192.jpg' });
		assert.strictEqual(upRes.status, 200);
		const file = upRes.body!;

		const expectedPrefix = `${OBJECT_STORAGE_ENDPOINT}/${OBJECT_STORAGE_BUCKET}/test/`;
		assert.ok(file.url.startsWith(expectedPrefix), `actual url: ${file.url}`);
		assert.ok(file.url.endsWith('.jpg'), `actual url: ${file.url}`);
		assert.ok(file.thumbnailUrl != null && file.thumbnailUrl.startsWith(expectedPrefix), `actual thumbnailUrl: ${file.thumbnailUrl}`);

		// オリジナルが取得でき、中身も一致する
		const original = await fetch(file.url);
		assert.strictEqual(original.status, 200);
		assert.strictEqual(original.headers.get('content-type'), 'image/jpeg');
		assert.ok(original.headers.get('content-disposition')?.includes('192.jpg'));
		assert.deepStrictEqual(
			new Uint8Array(await original.arrayBuffer()),
			new Uint8Array(await readFile(new URL('../resources/192.jpg', import.meta.url))),
		);

		// サムネイルが取得できる
		const thumbnail = await fetch(file.thumbnailUrl!);
		assert.strictEqual(thumbnail.status, 200);
		assert.strictEqual(thumbnail.headers.get('content-type'), 'image/webp');

		// 192.jpgはEXIF等を持たない小さい画像なのでwebpublicは生成されず、オリジナル・サムネイルが保存される
		const listed = await s3Client.send(new ListObjectsV2Command({
			Bucket: OBJECT_STORAGE_BUCKET,
		}));
		assert.ok((listed.KeyCount ?? 0) >= 2, `objects: ${JSON.stringify(listed.Contents?.map(o => o.Key))}`);
	});

	test('ファイルを削除するとオブジェクトストレージからも削除される', async () => {
		// 当該アップロード由来のキーを特定できるよう、事前のキー一覧を取得しておく
		const beforeKeys = new Set((await s3Client.send(new ListObjectsV2Command({
			Bucket: OBJECT_STORAGE_BUCKET,
		}))).Contents?.map(o => o.Key!) ?? []);

		// EXIFを持つrotate.jpgを使い、webpublic代替画像の生成・削除も検証対象にする
		// (EXIF等を持たない小さい画像はsatisfyWebpublicによりwebpublicが生成されない)
		const upRes = await uploadFile(root, { path: 'rotate.jpg' });
		assert.strictEqual(upRes.status, 200);
		const file = upRes.body!;

		const expectedPrefix = `${OBJECT_STORAGE_ENDPOINT}/${OBJECT_STORAGE_BUCKET}/test/`;
		assert.ok(file.url.startsWith(expectedPrefix));
		assert.ok(file.thumbnailUrl != null && file.thumbnailUrl.startsWith(expectedPrefix));

		// original・webpublic・サムネイルの3オブジェクトが作られていることを確認
		const listedAfterUpload = await s3Client.send(new ListObjectsV2Command({
			Bucket: OBJECT_STORAGE_BUCKET,
		}));
		const uploadedKeys = (listedAfterUpload.Contents?.map(o => o.Key!) ?? [])
			.filter(key => !beforeKeys.has(key));
		assert.ok(uploadedKeys.length >= 3, `uploaded keys: ${JSON.stringify(uploadedKeys)}`);

		const delRes = await api('drive/files/delete', { fileId: file.id }, root);
		assert.strictEqual(delRes.status, 204);

		// 削除はジョブキュー経由で行われるので完了まで待つ(S3上のキー消失で判定する)
		await vi.waitFor(async () => {
			const listedAfterDelete = await s3Client.send(new ListObjectsV2Command({
				Bucket: OBJECT_STORAGE_BUCKET,
			}));
			const remainingKeys = uploadedKeys.filter(key => listedAfterDelete.Contents?.some(o => o.Key === key));
			assert.deepStrictEqual(remainingKeys, [], `remaining keys: ${JSON.stringify(remainingKeys)}`);
		}, { timeout: 30_000, interval: 500 });

		// 匿名GETが404になることも確認する(403など「読めないがオブジェクトが残っている」状態と区別するため)
		assert.strictEqual((await fetch(file.url)).status, 404);
	});
});
