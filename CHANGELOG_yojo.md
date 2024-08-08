<!--
## x.x.x (unreleased)

### Release Date

### General
-

### Client
-

### Server
-

### Misc

-->
## x.x.x (unreleased)

### Release Date

### General
- Enhance: リバーシをリモートユーザーと対戦できるように [#271](https://github.com/yojo-art/cherrypick/pull/271)

### Client
- Enhance: 個別に通知を削除できるように

### Server
- Change: redisForRemoteClipsをredisForRemoteApisに変更

### Misc

## 0.4.1

### Release Date
2024-08-02

### General
- Fix: チャンネルに関する権限定義を削除

### Client
- Fix: 非ログイン状態でメディアタイムラインが選べないバグ修正
- Fix: NSFWを常に表示にする設定でも年齢確認処理を行う前は隠す
- Enhance: 通知を削除する際に確認を出すように

### Server
-

### Misc

## 0.4.0
Cherrypick 4.9.0

### Release Date
2024-07-28

### General
- Remove: 連合過激派によってローカルのみ投稿機能は削除されました

### Client
- Fix: 引用とCWを併用した場合にタイムラインと詳細で表示が異なる不具合を修正 [#231](https://github.com/yojo-art/cherrypick/issues/231)
- Feat: サイコロウィジェット  
(Cherry-picked from https://github.com/1673beta/cherrypick/pull/73)
- Enhance: 絵文字のインポート時にリモートから取得した値で埋めた編集ダイアログを表示する
- Fix: メディアタイムラインの可視性を変更できない問題を修正 [#54](https://github.com/yojo-art/cherrypick/issues/54)
- Feat: NSFWフラグの付いた画像と動画で年齢確認ダイアログを出す [#245](https://github.com/yojo-art/cherrypick/pull/245)

### Server
-

### Misc


## 0.3.4
Cherrypick 4.9.0-beta.2

### Release Date
2024-07-21

### General
- Enhance: 現在のインデックスを破棄して全ノートを強制的にインデックスさせるAPIの追加(コントロールパネル/その他)
- Enhance: 全ノートを強制的にインデックスさせるAPIの追加(コントロールパネル/その他)  
(Based on https://github.com/TeamNijimiss/misskey/commit/e106092f5d4c79ec8d6ad53431ecb46839afe26c)

### Client
-

### Server
- Fix: グループ招待に返答すると通知が見れなくなる問題を修正
- Fix: notifications/deleteで通知を削除できない問題を修正
- Fix: 高度な検索(opensearch)でsudachiが使われていない問題を修正
  -  検索文に一致していてもノートが出てこないことがあるのを修正しました
  -  現在のインデックスを破棄して全ノートを再インデックスする必要があります

### Misc

## 0.3.3
Cherrypick 4.9.0-beta.2

### Release Date
2024-07-18

### General
-

### Client
- Change: 公式タグ一覧の画像高さを調節しました
- Fix: ハッシュタグTLで投稿フォームを閉じた後にリロードしないように
- Feat: 通知画面で通知を消せるように  
(Cherry-picked from https://github.com/1673beta/cherrypick/pull/76)

### Server
- feat: 通知を個別削除するAPI  
(Cherry-picked from https://github.com/1673beta/cherrypick/pull/76)
### Misc

## 0.3.2
Cherrypick 4.9.0-beta.2

### Release Date
2024-07-16

### General
-

### Client
- Change: 非ログイン時のインスタンス画面にマスコット画像/人気の投稿を表示しなくなりました

### Server
- Fix: ステータスページURLが返ってこない問題を修正

### Misc

## 0.3.1
Cherrypick 4.9.0-beta.2

### Release Date
2024-07-15

### Server
- fix: inquiryUrlが設定できない不具合を修正

## 0.3.0
Cherrypick 4.9.0-beta.2

### Release Date
2024-07-15

### General
- Feat: リモートユーザーのクリップが閲覧できるように
  - お気に入りは未実装です
  - ログインが必要な投稿は見れません

### Client
-

### Server
- Feat: OpenSearchを利用できるように
- Enhance: 高度な検索に新たな条件を追加(OpenSearchが必要です)
	- 添付ファイルのセンシティブ条件(なし/含む/除外)
	- 引用ノート除外
  - 検索方法の詳細はdoc/Advanced-Search.mdに 
- Change: APIのパラメータを変更
	-  notes/advanced-search の"excludeNsfw"を"excludeCW"に変更  
	-  notes/advanced-search の"channelId"を削除  
 
## 0.2.2
Cherrypick 4.9.0-beta.2

### Release Date
2024-07-13

### General

### Client

### Server
- remove: チャンネル機能のAPIを削除
 
## 0.2.1
Cherrypick 4.9.0-beta.2

### Release Date
2024-07-11

### Client
- feat: マスコット画像を表示するウィジェットを追加

## 0.2.0
Cherrypick 4.9.0-beta.2

### Release Date
2024-07-8

### General
- enhance: ノートとユーザーの検索時に照会を行うかが選択できるようになりました
	- @foo@example.com 形式でユーザ検索した場合に照会ができるようになりました
- remove: チャンネル機能を削除
- add: 公式タグ機能を追加
  - インスタンスで利用が推奨されるハッシュタグの一覧です

### Client
- feat: 未ログイン時サーバーで指定されている場合、マスコット画像が表示されます
- enhance: ハッシュタグTLをリアルタイムに更新
- fix: アンケート選択肢にリモート絵文字を表示

### Server
- fix: リモートユーザーにはファイルサイズ制限を適用しない
- fix: メディアタイムライン選択時の上部のアイコンを修正
- add: メディアタイムラインのチュートリアルを追加
- feat: マスコット画像を指定できるように(コントロールパネル/ブランディング)
  - デフォルト値(/assets/ai.png)または空欄の場合タイムラインが表示されます

## 0.1.0 (unreleased)
Cherrypick 4.8.0

### General
- enhance: メディアプロキシurlと拡大画像urlを分割
- enhance: 1ファイルの容量をロールでも制限できるように

### Client
- enhance: ノートとユーザーの検索時に照会を行うかが選択できるようになりました
	- @foo&#8203;@example.com 形式でユーザ検索した場合に照会ができるようになりました
- add: 通知音を追加 [@mujin-nohuman (無人)](https://github.com/mujin-nohuman)
- fix: "キャッシュをクリア"してもインスタンス情報が更新されない不具合を修正 [#101](https://github.com/yojo-art/cherrypick/issues/101)

### Server
- enhance: remoteProxyエンドポイント設定を追加
- fix: webpublic生成時にドライブの縮小設定を見るように

### Others
- engawaをマージ
- cherrypickからフォーク
