## test-federation
Test federation between two CherryPick servers: `a.test` and `b.test`.

Before testing, you need to build the entire project, and change working directory to here:
```sh
pnpm build
cd packages/backend/test-federation
```

First, you need to start servers by executing following commands:
```sh
bash ./setup.sh
NODE_VERSION=22 docker compose up --scale tester=0
```

Then you can run all tests by a following command:
```sh
NODE_VERSION=22 docker compose run --no-deps --rm tester
```

For testing a specific file, run a following command:
```sh
NODE_VERSION=22 docker compose run --no-deps --rm tester -- pnpm -F backend test:fed packages/backend/test-federation/test/user.test.ts
```

### AP emoji normalization tests (`#1049`)

Tests under `describe('AP絵文字タグの正規化')` in `test/emoji.test.ts` use the dedicated stub host `z.test`:

- **nginx** (`z.test`): static ActivityPub fixtures (`stub/` — Actor / Note / Emoji 画像)
- **stub-deliver** (`z.test.deliver`): `alice` の秘密鍵で `Create` に HTTP Signature を付与し、対象インスタンスの `/inbox` へ配送

テストは `POST https://z.test/deliver` を呼ぶだけで、署名は z.test 側が行う（Misskey / tester 側では署名しない）。

`bash ./setup.sh` で `z.test` の TLS 証明書と `.config/z.test.conf` を生成する。`example.stub.conf` に `/deliver` の proxy 設定を追加した場合は、既存の `.config/z.test.conf` を再生成するか `location /deliver` ブロックを手動でマージしてから `docker compose up` すること。
