---
name: release-pr
description: yojo-art のリリース用PRを作成・レビューするときなどに使用する。
---

# release-pr

yojo-art/cherrypick のリリース用 PR を作成・レビューするときに使うスキル。  
過去のリリース PR (#988, #1031, #1112, #1121, #1235) の実績と現在のリポジトリ状態に基づく。

## リポジトリ状態（参考）

- ルート `package.json`
  - `name`: `yojo-art`
  - `version`: `1.8.2`
  - `basedCherrypickVersion`: `4.17.0`
  - `basedMisskeyVersion`: `2025.12.2`
  - `codename`: `tonjiru`
- SDK パッケージ
  - 現在: `packages/misskey-js/package.json`（`name: misskey-js`, `version: 1.8.2`）
  - 1.7.x 系では `packages/cherrypick-js/package.json`（`name: cherrypick-js`）を更新していた
- 更新対象の CHANGELOG: **`CHANGELOG_YOJO.md`**（`CHANGELOG.md` や `CHANGELOG_CHERRYPICK.md` は触らない）

## このスキルの役割
1. **/release-prのみで実行されたときは、どのPR番号をレビューするのかユーザーに質問すること。**

2. **「リリースPRを作成してください」という指示が行われない限りはリリースPRを作成しないでください**

## リリース PR の作り方

1. **対象ブランチを決める**
   - パッチリリース: メンテナンスブランチ `1.8.x`, `1.7.x` など
   - マイナー/メジャーリリース: `develop` → `master` など
2. **バージョンを決める**
   - ルート `package.json` の `version` と、SDK パッケージの `version` を同じ値に更新する
   - `basedCherrypickVersion` / `basedMisskeyVersion` / `codename` は上流マージが無ければ変更しない
3. **`CHANGELOG_YOJO.md` に新しいバージョンブロックを追加**
   - ファイルの先頭に挿入する
   - 空でも `### General` / `### Client` / `### Server` は必ず置く
   - 必要に応じて `### Others` を追加
   - マイルストーン内のクローズ済み PR / Issue を材料にする
4. **コミット・ブランチ**
   - ブランチ名例: `release/x.y.z`（過去の PR ではフォーク側が `1.8.x` / `1.7.x` となっていた）
   - コミットメッセージ例: `Release: x.y.z(Develop)` または `Changelog x.y.z`
5. **PR 作成**
   - タイトル例: `Release: x.y.z(Develop)` / `Changelog x.y.z`
   - 本文はリポジトリ既定のテンプレートを使用。What/Why に「バージョン更新と CHANGELOG 追記」と記入
   - 該当バージョンのマイルストーンを設定する
6. **最終チェック**
   - ルートと SDK パッケージの `version` が一致している
   - `CHANGELOG_YOJO.md` の日付・リンク・Prefix が規約通り
   - 他の CHANGELOG ファイルや locale ファイルを誤って変更していない

## CHANGELOG_YOJO.md の書式（過去の傾向）

```markdown
## x.y.z
Cherrypick A.B.C  
Misskey YYYY.M.P

### Release Date
YYYY-MM-DD

### General

### Client
- Fix: ... [#123](https://github.com/yojo-art/cherrypick/pull/123)

### Server
- Fix: セキュリティに関する修正 (Cherry-picked from misskey YYYY.M.P)

### Others
- ...
```

- `Cherrypick ...` / `Misskey ...` は行末に 2 つのスペースを入れて改行する
- セクションは `General` / `Client` / `Server` / `Others`
- 各エントリの Prefix: `Feat:` / `Enhance:` / `Change:` / `Fix:` / `Remove:`
- 変更元 PR があれば `[#num](https://github.com/yojo-art/cherrypick/pull/num)` でリンクする
- サブ項目は 2 スペースまたはタブでインデントする
- セキュリティ修正は `Fix: セキュリティに関する修正 (Cherry-picked from misskey ...)` の形
