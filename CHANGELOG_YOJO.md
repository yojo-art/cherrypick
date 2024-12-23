## 1.2.2
Cherrypick 4.13.0  
Misskey 2024.10.1

### Release Date
xxxx-xx-xx

### General
-

### Client
- Fix: ノート詳細画面でリアクション出来ない [#584](https://github.com/yojo-art/cherrypick/pull/584)
- Fix: タイムラインオプションで表示有無選択の選択肢を修正 [#590](https://github.com/yojo-art/cherrypick/pull/590)
- Fix: MFMチートシートが表示できない不具合を修正 [#592](https://github.com/yojo-art/cherrypick/pull/592)

### Server
-

## 1.2.1
Cherrypick 4.13.0  
Misskey 2024.10.1

### Release Date
2024-12-21

### General
-

### Client
- Fix: すべてのノートに翻訳ボタンが表示される/本文がなくて投票だけあると翻訳が表示されなくなる [#579](https://github.com/yojo-art/cherrypick/pull/579)
- Fix: ユーザーTLファイル付きノートTLの修正 [#580](https://github.com/yojo-art/cherrypick/pull/580)
  - ユーザー設定アピアランスのセンシティブ画像を常に表示が無視されてたのを修正
  - ユーザー設定アピアランスの画像を常に非表示が無視されてたのを修正
  - ユーザー設定アピアランスの非表示の画像をダブルクリックして開く設定が無視されてたのを修正
  - ユーザー設定全般のデータセーバー、メディアの読み込みを無効化が無視されてたのを修正
  - センシティブ画像を開く時に年齢確認ダイアログを表示する機能が無視されてたのを修正
  - 画像左上にALT/GIF/APNG/センシティブの表示を追加
- Fix: リモートクリップ/リモートplay機能のURLで外部サイト警告が出る問題を修正 [#581](https://github.com/yojo-art/cherrypick/pull/581)

### Server
-

## 1.2.0
Cherrypick 4.13.0  
Misskey 2024.10.1

### Release Date
2024-12-20

### General
- Change: nodeinfoでyojo-artを名乗る [#565](https://github.com/yojo-art/cherrypick/pull/565)
- Fix: ノートを編集する時に検索許可範囲を記憶する [#558](https://github.com/yojo-art/cherrypick/pull/558)

### Client
- Fix: 絵文字情報表示でローカルのものに絵文字URLが表示されない [#562](https://github.com/yojo-art/cherrypick/pull/562)
- Enhance: 表示中のタグTLをお気に入り登録するボタンを追加 [#561](https://github.com/yojo-art/cherrypick/pull/561)

### Server
- Fix: `api/ap/fetch-outbox`が正しく動作しないのを修正[#560](https://github.com/yojo-art/cherrypick/pull/560)
- Fix: PersonのserchableByが正しく連合できていないのを修正[#556](https://github.com/yojo-art/cherrypick/pull/556)
- Fix: SerchableByが未設定の時にプライバシーを更新できないことがある[#567](https://github.com/yojo-art/cherrypick/pull/567)
- Enhance: `/users/${id}`に`Accept: application/ld+json`ではないリクエストが来たとき`/@${username}`にリダイレクトするように [#554](https://github.com/yojo-art/cherrypick/pull/554)

## 1.1.0
Cherrypick 4.11.1  
Misskey 2024.8.0

### Release Date
2024-11-08

### Note

ノートが多数ある場合**マイグレーションに長時間かかることがあります**  

docker環境でノートレコードが多数(数百万件)ある場合**一時的に** compose.ymlの`healthcheck`の`start_period`を大きめに指定してください
```
#サービスのwebに追記
    healthcheck:
      test: ["/bin/bash", "/misskey/healthcheck.sh"]
      interval: "5s"
      retries: 20
      start_period: "300s"#5分
```
インデックス構造が変わったためノートインデックスの再作成が必要です。
リアクションや投票が途中からインデックスにされるので再インデックスをおすすめします。
### General

- Fix: 照会かリモートユーザーの投稿取得で作成されたノートの場合通知を発行しないように
- Feat: 検索許可制限、SearchableByに対応 [#519](https://github.com/yojo-art/cherrypick/pull/519)
- Feat: 検索許可制限、mastodonのindexableに対応 [#449](https://github.com/yojo-art/cherrypick/pull/449),[#502](https://github.com/yojo-art/cherrypick/pull/502),[#504](https://github.com/yojo-art/cherrypick/pull/504),[#507](https://github.com/yojo-art/cherrypick/pull/507)
  - 検索で表示される条件を制限できるようになります
  - 設定→プライバシーより設定できます
  - 設定されている場合対応しているサーバーでは、以下のことをしたユーザーのみ検索できます
    - リアクション
    - リノート
    - クリップ
    - お気に入り
    - 返信
    - 投票
	- コントロールパネル→その他で(クリップ、お気に入り、投票が)再インデックスできるようになりました
- Feat: 予約投稿 [#483](https://github.com/yojo-art/cherrypick/pull/483)
	- based-on
 		- https://github.com/Type4ny-Project/Type4ny/commit/e133a6b6a4bee78c2598deaad087712b2e8e26ed
  		- https://github.com/Type4ny-Project/Type4ny/commit/387faf55cf8b98918bc6c83fd8377d75408d7d1a
  		- https://github.com/Type4ny-Project/Type4ny/commit/540f531b6d10e5419e63012ad63a637d4d7d084a
  		- https://github.com/Type4ny-Project/Type4ny/commit/12b7ec30461eee0c80abf7ecc965ed904bb0edee
  		- https://github.com/Type4ny-Project/Type4ny/commit/d6fb3c3342da111520eda6b18837f17fb3b50b5e
  		- https://github.com/Type4ny-Project/Type4ny/commit/9bc6d8024fcab8855fb3e2aa86bb1d74d853eb70
  		- https://github.com/Type4ny-Project/Type4ny/commit/28ee4d47c0b240db6eb30e14291e44862b1f7484
- Enhance: 連合一覧のソートにリバーシのバージョンを追加 [#436](https://github.com/yojo-art/cherrypick/pull/436)
- Enhance: リモートのクリップをお気に入りに登録できるように [#438](https://github.com/yojo-art/cherrypick/pull/438)
- Enhance: リモートのPlayを遊べるように [#447](https://github.com/yojo-art/cherrypick/pull/447)
- Enhance: リモートのPlayをお気に入りに登録できるように [#447](https://github.com/yojo-art/cherrypick/pull/447)
- Enhance: ノートにつけられたリアクションを対象にした検索ができるように [#496](https://github.com/yojo-art/cherrypick/pull/496)
  - Opensearchのみ対応 
  - Opensearchの設定で` reactionSearchLocalOnly: true`にすることでリモートのカスタム絵文字リアクションをインデックス対象外にできます
- Enhance: 高度な検索でフォロー中/フォロー外を検索条件にできるように [#503](https://github.com/yojo-art/cherrypick/pull/503)
- Enhance(Opensearch): 表記ゆれがヒットしないようにするオプションを追加 [#498](https://github.com/yojo-art/cherrypick/pull/498)

### Client
- Fix: ユーザーページでリアクション履歴が閲覧できる状態の時にリアクションを選択するとユーザーの投稿が表示されてしまうの修正 [#429](https://github.com/yojo-art/cherrypick/pull/429)
- Fix: リモートから添付されてきたクリップURLにホスト情報があると二重になる不具合を修正 [#460](https://github.com/yojo-art/cherrypick/pull/460)
- Fix: リモートクリップ説明文がローカル仕様になってる問題の修正 [#466](https://github.com/yojo-art/cherrypick/pull/466)
- Fix: ユーザー概要の「ファイル」の挙動を通常の添付ファイルに合わせる [#472](https://github.com/yojo-art/cherrypick/pull/472)
- Fix: チャットの絵文字ピッカーが正しく入力できないことがあるのを修正 [#497](https://github.com/yojo-art/cherrypick/pull/497)
- Fix: リモートから添付されてきたクリップURLにホスト情報があると二重になる不具合を修正 [#460](https://github.com/yojo-art/cherrypick/pull/460)
- Fix: リモートクリップ説明文がローカル仕様になってる問題の修正 [#466](https://github.com/yojo-art/cherrypick/pull/466)
- Fix: ユーザー概要の「ファイル」の挙動を通常の添付ファイルに合わせる [#472](https://github.com/yojo-art/cherrypick/pull/472)
- Fix: チャットの絵文字ピッカーが正しく入力できないことがあるのを修正 [#497](https://github.com/yojo-art/cherrypick/pull/497)
- Fix: サーバー情報画面で公式タグを選択するとヘッダが公式タグのままになる不具合を修正 [#527](https://github.com/yojo-art/cherrypick/pull/527)
- Enhance: チャートの連合グラフで割合を表示 [#437](https://github.com/yojo-art/cherrypick/pull/437)
- Enhance: お気に入り登録クリップの一覧画面から登録解除できるように [#448](https://github.com/yojo-art/cherrypick/pull/448)
- Enhance: 高度な検索でもクエリ文字列を使えるように [#511](https://github.com/yojo-art/cherrypick/pull/511)
  - `/search?type=anote`
  - `q` 通常検索と同じ
  - `userId` 通常検索と同じ
  - `username` 通常検索と同じ
  - `host` 通常検索と同じ
  - `fileAttach`添付ファイル有無 あり:`file-only`なし:`no-file`
  - `fileSensitive`添付ファイルセンシティブ状態 あり:`includeSensitive` なし:`withOutSensitive`　センシティブのみ`sensitiveOnly`
  - `reactions` リアクション検索ボックス
  - `reactionsExclude` リアクション検索ボックス(除外)
  - `excludeReply` リプライ除外 true/false
  - `excludeCw` CW除外 true/false
  - `excludeQuote` 引用除外 true/false
  - `strictSearch` 表記ゆれ検索有効 true/false
- Enhance: 非ログイン時に動きのあるMFMを動かすか選べるように [#508](https://github.com/yojo-art/cherrypick/pull/508)
- Fix: デフォルトの公開範囲から連合なしを削除 [#532](https://github.com/yojo-art/cherrypick/pull/532)
- Fix: すべてのキューを今すぐ再試行するとモデログにロケールの無い項目が出現する問題を修正 [#534](https://github.com/yojo-art/cherrypick/pull/534)

### Server
- Change: `notes/advanced-search`で`query`が必須ではなくなりました [#496](https://github.com/yojo-art/cherrypick/pull/496)
- Change: 絵文字を登録する際にシステムユーザーとして再アップロードするように   [#510](https://github.com/yojo-art/cherrypick/pull/510)
  - (Cherry-picked from https://github.com/team-shahu/misskey/pull/11)
- Change: `api/admin/recreate-index`では再インデックスをしないように [#531](https://github.com/yojo-art/cherrypick/pull/531)
- Fix: 高度な検索でノート本文に含まれないタグが検索対象外なのを修正 [#530](https://github.com/yojo-art/cherrypick/pull/530)
- Fix: Opensearch利用時ファイルのセンシティブ状態が変更されたとき変更されるように [#501](https://github.com/yojo-art/cherrypick/pull/501)
- Fix: (Opensearch利用時)高度な検索でリプライ除外にするとエラーがでる [#449](https://github.com/yojo-art/cherrypick/pull/449)
- Fix: ノート編集時に3001文字以上の場合編集できない問題を修正 [#505](https://github.com/yojo-art/cherrypick/pull/505)
- Fix: 通知APIがページ境界で重複する問題の修正 [#509](https://github.com/yojo-art/cherrypick/pull/509)
- Enhance: リモートユーザーの`/api/clips/show`と`/api/users/clips`の応答にemojisを追加 [#466](https://github.com/yojo-art/cherrypick/pull/466)
- Enhance: `api/emoji`で`host`を指定できるように [#514](https://github.com/yojo-art/cherrypick/pull/514)


## 1.0.1
Cherrypick 4.11.1  
Misskey 2024.8.0

### Release Date
2024-09-06

### General
-

### Client
- Fix: 翻訳が成功しても翻訳中のままになるのを修正 [#415](https://github.com/yojo-art/cherrypick/pull/415)

### Server
- Change: 溢れそうなチャートの型を大きいものに変更 [#417](https://github.com/yojo-art/cherrypick/pull/417)


## 1.0.0
Cherrypick 4.11.1  
Misskey 2024.8.0

### Release Date
2024-09-05

### General
-

### Client
- Fix: 非ログインでリバーシの戦績が見れない不具合の修正 [#404](https://github.com/yojo-art/cherrypick/pull/404)
- Fix: 翻訳に失敗したとき読み込み中のままになるのを修正 [#407](https://github.com/yojo-art/cherrypick/pull/407)
- Fix: ノート詳細の本文表示優先度を変更 [#408](https://github.com/yojo-art/cherrypick/pull/408)
- Feat: 同じノートを連続してリノートしようとしたときに警告する設定を追加(設定→全般) [#409](https://github.com/yojo-art/cherrypick/pull/409)
- Enhance: ユーザー概要の...からサーバー情報にリンクを追加 [#406](https://github.com/yojo-art/cherrypick/pull/406)

### Server
-


## 0.6.0
Cherrypick 4.11.1

### Release Date
2024-08-31

### General
- Feat: 相互リンク機能の追加 [#319](https://github.com/yojo-art/cherrypick/pull/319)
  - (Cherry-picked from https://github.com/MisskeyIO/misskey/pull/675)
  - (Cherry-picked from https://github.com/MisskeyIO/misskey/pull/684)
  - (Cherry-picked from https://github.com/MisskeyIO/misskey/pull/690)
  - (Cherry-picked from https://github.com/MisskeyIO/misskey/pull/696)

### Client
- Enhance: 更新情報を確認の画面に幼女.artのチェンジログへのボタンを追加 [#374](https://github.com/yojo-art/cherrypick/pull/374)
- Enhance: `/about`で公式タグを表示できるように [#357](https://github.com/yojo-art/cherrypick/pull/357)
- Fix: 検索画面の不具合を修正 [#346](https://github.com/yojo-art/cherrypick/pull/346)
  - リモートユーザー高度な検索画面で照会しますか？のダイアログが出ない問題
  - ユーザー検索画面で照会しますか？のダイアログが2つ出る問題 
- Fix: 更新情報を確認のCherryPickの項目へのリンクを修正 [#372](https://github.com/yojo-art/cherrypick/pull/372)
- Feat: お気に入りのタグリストを作成できるように [#358](https://github.com/yojo-art/cherrypick/pull/358)
- Enhance: リバーシ連合の対応状況をサーバー一覧に表示するように [#384](https://github.com/yojo-art/cherrypick/pull/384)

### Server
- Fix: ユーザーnull(System)の場合forceがfalseでも新規追加されるのを修正 [#363](https://github.com/yojo-art/cherrypick/pull/363)
- Fix: Outboxから投稿を所得する際にタイムラインに投稿が流れないように [#348](https://github.com/yojo-art/cherrypick/pull/348)
- Fix: 翻訳にdeepl以外を利用していると翻訳できない問題を修正 [#355](https://github.com/yojo-art/cherrypick/pull/355)
- Fix: 絵文字インポート時にすでにファイルがあるならそれを使うように [#362](https://github.com/yojo-art/cherrypick/pull/362)
- Enhance: リバーシ連合の対応状況をnodeinfoに追加 [#379](https://github.com/yojo-art/cherrypick/pull/379)


## 0.5.2
Cherrypick 4.10.0-rc.3

### Release Date
2024-08-15

### General
-

### Client
- Enhance:メンションや引用、返信の通知も削除できるように [#314](https://github.com/yojo-art/cherrypick/pull/314)
- Fix:デッキモードで通知カラムがあるとリロードするたびに毎回通知を消すか聞かれる問題を修正 [#314](https://github.com/yojo-art/cherrypick/pull/314)
- Fix:通知を全削除できない問題を修正 [#314](https://github.com/yojo-art/cherrypick/pull/314)
- Fix:通知ポップアップにも通知削除ボタンが表示される [#314](https://github.com/yojo-art/cherrypick/pull/314)
- Fix: MFMでURLの表示文字列を変更した時にリモートクリップURLが書き換えられない [#324](https://github.com/yojo-art/cherrypick/pull/324)
- Enhance: リモートクリップのURLプレビューをリモートURLで生成 [#324](https://github.com/yojo-art/cherrypick/pull/324)

### Server
- Fix:withCats(ネコミミ付きのみのstreaming)がフィルタされていない問題を修正 [#323](https://github.com/yojo-art/cherrypick/pull/323)


## 0.5.1
Cherrypick 4.10.0-rc.3

### Release Date
2024-08-13

### General
-

### Client
-

### Server
- Fix: APリクエストannounceNoteを受け取れない問題を修正  [#310](https://github.com/yojo-art/cherrypick/pull/310)


## 0.5.0
Cherrypick 4.10.0-rc.3

### Release Date
2024-08-13

### General
- Enhance: リバーシをリモートユーザーと対戦できるように [#271](https://github.com/yojo-art/cherrypick/pull/271)
- Feat: Outboxから投稿を取得するAPIを追加 [#288](https://github.com/yojo-art/cherrypick/pull/288)

### Client
- Change: 高度な検索を別タブに分離
- Enchance: 高度な検索でホスト名を指定できるように [#285](https://github.com/yojo-art/cherrypick/pull/285)
- Enhance: 個別に通知を削除できるように [#289](https://github.com/yojo-art/cherrypick/pull/289)
- Enhance: 通知を削除する際に確認を出すように [#287](https://github.com/yojo-art/cherrypick/pull/287)
- Fix: ページ遷移に失敗することがある問題を修正
(Cherry-picked from https://github.com/misskey-dev/misskey/pull/14380)
- Fix: ダイスウィジェットのロケールが無い問題を修正
(Cherry-picked from https://github.com/1673beta/cherrypick/pull/74)

### Server
- Change: redisForRemoteClipsをredisForRemoteApisに変更 [#293](https://github.com/yojo-art/cherrypick/pull/293)
  - ./config/default.ymlファイルの変更が必要です
-	Enhance: 高度な検索に検索のオフセットを指定できるように [#285](https://github.com/yojo-art/cherrypick/pull/285)


## 0.4.1
Cherrypick 4.9.0

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
