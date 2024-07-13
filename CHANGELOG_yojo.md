<!--
## yojo-x.x.x (unreleased)

### Release Date

### General
-

### Client
-

### Server
-

### Misc

-->
## 0.2.2
Cherrypick 4.9.0-beta.2

### Server
remove: チャンネル機能のAPIを削除

## 0.2.1
Cherrypick 4.9.0-beta.2

### Client
- feat: マスコット画像を表示するウィジェットを追加

## 0.2.0
Cherrypick 4.9.0-beta.2

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
