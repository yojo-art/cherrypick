# z.test — 連合テスト用スタブホスト

`z.test` は Misskey ではない最小の ActivityPub ホストで、署名付き配送の差し出し人と受信観測点の両方を担う。テストは Misskey / tester 側で署名せず、`POST https://z.test/deliver` を呼ぶだけで署名付き配送を依頼できる。

## 構成

- **nginx** (`z.test`): 静的 ActivityPub フィクスチャ (`stub/` — Actor / Note / Emoji 画像) を配信する
- **stub-deliver** (`z.test.deliver`): 配送代行。`stub-deliver.mjs` が鍵ペアから HTTP Signature / LD 署名を付与し、対象インスタンスの `/inbox` へ配送する

## エンドポイント

### `POST /deliver` — 署名付き inbox 配送の依頼

```json
{
  "targetHost": "a.test",
  "notePath": "json-ld-signature/01-mention-self",
  "placeholders": { "nonce": "...", "recipient": "https://..." },
  "ld": "valid",
  "http": "valid",
  "activityId": "https://..."
}
```

- `notePath`: `stub/notes/` からの相対パス。`type` が `Announce` のものはそのまま Activity として配送し、それ以外は `Create` でラップして配送する。`id` のない Announce は配送毎に一意な `id` を採番する
- `placeholders`: フィクスチャ内の `{{key}}` を置換する
- `ld`: LD署名モード。`none` (既定・LDなし) / `valid` / `tampered-body` (署名後に本文改変) / `tampered-value` (署名値改変) / `wrong-type` (`DataIntegrityProof` にすり替え) / `creator-mismatch` (mallory 鍵で署名)
- `http`: HTTP署名モード。`valid` (既定) / `broken` (署名破壊＝LDフォールバック経路の検証用)
- `activityId`: 配送する Activity の `id` を上書きする
- 応答: `{ activityId, inboxUrl, inboxStatus }`。inbox は非同期処理のため `inboxStatus` は受付結果 (通常 202) であり、取り込み可否は表さない

### `POST /follow` — zack としてのフォロー

`{ targetHost, object }` を受け取り、zack (`https://z.test/users/zack`) が `object` (ユーザーURI) をフォローする Activity を配送する。中継配送の観測者として zack を使う準備に用いる。

### `POST /inbox` / `GET /received` — 受信記録の観測

`https://z.test/inbox` への配送 (テスト対象インスタンスからの配達物を含む) を `stub-deliver` が最大500件まで記録する。

- `GET /received?text=...`: 記録の JSON に `text` を含むものの一覧
- `POST /received/clear`: 記録の全消去
- 転送トラフィックの有無の観測に使う (`note-update-delivery.test.ts` が前例)

## フィクスチャ (`stub/`)

- `stub/users/zack` / `stub/users/zack-key.json`: zack の Actor 文書と鍵。`generate-actor-keys.mjs` が生成する
- `stub/users/mallory` / `stub/users/mallory-key.json`: LD の creator/actor 不一致テスト用の第二アクター (zack とは別鍵)
- `stub/notes/<suite>/`: Note / Announce フィクスチャをテストスイートごとに分ける (`ap-emoji-1049/`、`channel-mention/`、`json-ld-signature/`)
- 絵文字画像は `stub/emoji/hello_world.png` の 1 枚を共通利用する
- `outbox` / `inbox` / `.well-known/nodeinfo` / `manifest.json` など、リモートインスタンスとして参照される最小エンドポイントも置いている

`bash ./setup.sh` で `z.test` の TLS 証明書・`.config/z.test.conf` を生成する。鍵ペアは `setup.sh` 時と `z.test.deliver` 起動時の双方で (再) 生成される。

## LD署名用の依存調達 (`stub-vendor/`)

`z.test.deliver` は隔離ネットワーク (`internal`) 上にあるため、起動時に npm registry へ到達できない。このため LD 署名に使う `jsonld` (backend 依存と同バージョン) は `setup.sh` がホスト側 (ネットワークあり) で `./stub-vendor/` に前もって install し、`compose.z.yml` で `/app/vendor` にマウントして使う。`stub-vendor/` は生成物のため git 管理外 (`.gitignore` 済み)。

`setup.sh` をネットワークなしで実行した場合、`stub-vendor/` が無い状態になる。この場合 `z.test.deliver` 自体は起動するが、`ld=valid/...` を指定した配送は「`setup.sh` をネットワークありで実行せよ」という明示的エラーで失敗する (`ld=none` の従来配送には影響しない)。

LD署名の正規化に使うコンテキスト (`stub-deliver-contexts.json`) は backend の `PRELOADED_CONTEXTS` と完全一致が必要なため、手動コピーではなく `setup.sh` が `packages/backend/src/core/activitypub/misc/contexts.ts` から直接生成する (Node >= 22.18 の type stripping を利用、backend の `.github/min.node-version` も 22.22.2 のため既定で動作する)。生成物のため git 管理外 (`.gitignore` 済み)。
