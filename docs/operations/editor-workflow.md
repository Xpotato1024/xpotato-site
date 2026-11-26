---
status: proposed
owner: development
last_verified: 2026-11-26
---

# CMSで記事を制作し、同じPRをAIへ渡す

下書きのプレビュー・添削はCMSを第一の引継ぎ先とする。AIは本文と参照画像を同じGit下書きにそろえ、CMSで開いて確認できる状態まで進める。非公開Draftの読み書きは所有者から常時認可されているため、所有者認証済みの既存経路で登録・再取得・復元を行い、操作ごとの許可確認は求めない。

## 人間の操作

/editor/のホームで、始める作業を選ぶ。

| 入口           | 編集を始めるまでの操作                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 新規作成       | 記事・メモ・教育記事・固定ページ・ツール・プロダクト紹介から投稿先を選ぶ。                                                                 |
| 既存記事を改稿 | Gitの読み込み元と一覧を取得し、公開済みの記事を検索して選ぶ。同じContentIdの改稿用下書きとして開く。                                   |
| 下書きの続き   | 端末またはGitの下書きを検索して選ぶ。AI下書きなどを確認するときは「添削から開く」を選ぶ。MDX・バックアップの取り込みもこの画面で行う。 |

新規作成と公開記事の改稿では、編集前に「新しいブランチ」「既存のブランチ」「この端末」から作業場所を選ぶ。Gitへの保存先は`content/`で始まるブランチに限る。公開記事を既存ブランチへ持ち込む場合、同じpathに別の本文があれば開始を止め、そこで進んでいる改稿を上書きしない。

「下書きの続き」でGit原稿を開く場合は、読み込み元の`content/*`ブランチをそのまま使う。原稿を選んだ後に別の作業ブランチへ変更する欄は出さず、継続するブランチ名を表示する。「添削から開く」でも同じ原稿・ブランチを維持する。作業ブランチがある端末下書きも同じ場所で再開し、オフラインで開く際に保存先や取得時のcommitを消さない。まだGitへ結び付けていない端末下書きには、作業場所を選ぶ入口を残す。

新規は「作成して編集」、選んだ原稿は「編集を始める」で進む。ホームを見るだけでは空原稿を保存しない。読み込み元を変更したら一覧を取り直し、旧ブランチの一覧や遅れて返った応答から編集を始めない。

編集画面上部では「ブロック」「プレビュー」「MDX」を切り替える。三つとも同じ原稿を扱い、MDXは通常本文だけを表示する。Markdown/MDXが本文の正本であり、モードを切り替えるだけで書き換えない。公開日は執筆時に創作しない。画像は用途を選び、画質・文字・時間軸を確認してから私有媒体へ同期する。

Gitには固定commitの分類・部品契約を使って保存し、Draft PRを作る。AIに渡すのは同じPR、ContentId、作業ブランチと最新commit。別端末の更新と衝突した場合は手元の原稿を保持し、remoteを比較する。force pushで上書きしない。

構成や添削の動きを先に試す場合は、ホームの「操作サンプルを開く」を使える。二つのグループ、数式・コード、指摘と修正案を含む別の端末下書きができる。AI下書きと添削は模擬データで、実記事やGitを更新する操作ではない。

Draft PRの「Editor Astro layout preview」が成功したら、CMSの「Astroレビューを取得」で正規のレイアウトを表示する。公開CIは文章・CSSのみ、私有画像はその端末の確認済みhash/assetIdへ解決する。別端末では先に「別端末の画像を復元」を行う。原稿変更後は古いレビューを表示し続けず、最新commitの生成を待つ。表示専用のためブラウザツール操作は別のtool QAで確認する。

この正式レビューは、公開前検証の「vNext CI」が終わる前でも取得できる。原稿の保存先commitに対応する「Editor Astro layout preview」の成功を確認する。作業場の即時プレビューはGitHubの処理完了を待たずに使える。

## PWAの更新確認

ホーム画面と本文編集中のヘッダーにある「更新を確認」（狭い画面では更新アイコン）から、`/editor/sw.js` の更新をネットワークへ問い合わせる。Service Workerに変更がなければ「編集アプリは最新です」と表示し、原稿を再読み込みしない。新しいService Workerの準備中はその旨を表示し、インストール後に「保存して更新」へ進める。すでに待機中の版があれば、その場で適用できる。

適用時には編集中の原稿をIndexedDBへ保存し、履歴も保存できた場合だけ待機中のService Workerへ`ACTIVATE`を送信する。新しいworkerへの`controllerchange`を確認してから画面を再読み込みする。保存失敗・未インストール・適用のタイムアウトでは勝手に再読み込みしない。オフライン、非対応ブラウザ、Cloudflare Accessの認証が必要な状態では更新を完了したと表示しない。

この操作が更新するのは端末のCMS PWAシェルであり、GitHubの原稿、私有R2の媒体、公開サイトや配備設定には書き込まない。新しいアプリ版がサーバーに配備されていることが前提で、GitHubのPRを取り込む操作や本番デプロイの代わりではない。

## HEIC・GIFを専用処理へ渡す

ブラウザがHEICを安全にdecodeできない場合、またはGIFを可逆WebPへ変換する場合は同じrepositoryの専用処理を使う。AIもこの入口を使い、独自の別上限・別encoderにしない。

```sh
npm run editor:media -- --input /path/to/source.heic --output .local/editor-media/prepared.json --kind photo --allow-lossy
npm run editor:media -- --input /path/to/simulation.gif --output .local/editor-media/motion.json --kind animation
```

生成したprivate媒体ファイルをCMSの「専用処理で変換したHEIC・GIFを取り込む」で読み込む。原本名とは別のassetIdで参照し、内容/hash/画素数/容量を検証する。写真のlossyマスターは撮影原本とは呼ばない。元のファイルは自動削除しない。コマンド自体はR2保存、外部AI送信、本番登録を行わない。

## AIが作った原稿と画像をCMSへ渡す

一括登録とブランチ固定は[ADR-0093](../design/adr/0093-draft-handoff-identity.md)、所有者の既存GitHub認証を使う登録CLIは[ADR-0094](../design/adr/0094-owner-cli-draft-media.md)に記録する。同じrevisionのCLI・APIを使い、実環境への反映状況と対象の検証結果は対応PRで確認する。

公開Draft PRを読み、固定commitとContentIdを確認して同じブランチへ追pushする。人間の入力にAIが実質的な本文や図版を追加した場合はproducerを偽装しない。編集時の未完成原稿と正式Article Jobの入力を区別する。

AIが画像を追加した場合は、MDX内のassetIdを保った引継ぎファイルを準備し、Draft専用CLIまたは所有者認証済みCMSから非公開Draftへ登録する。AIは実行端末にあるGitHub CLIの所有者認証を再利用する経路を優先する。本文のpushと本人限定Sitesへの表示だけでは、CMSで画像を復元できる状態にはならない。

まず、下書きを正規の`content/` pathへ`draft:true`で保存し、派生目録を再生成して同じ作業ブランチ・Draft PRに含める。対象branchと保存済みcommitを取得し、そのcommitに対応する素材の一覧を`.local`へ作る。次は`architecture-editor`と`architecture-delivery`を参照する原稿の例であり、実際には本文・heroが参照する画像をすべて指定する。

```json
[
  {
    "assetId": "architecture-editor",
    "input": ".local/diagrams/architecture-editor.png",
    "kind": "technical"
  },
  {
    "assetId": "architecture-delivery",
    "input": ".local/diagrams/architecture-delivery.png",
    "kind": "technical"
  }
]
```

固定したcommitを指定して、同じrepositoryの準備CLIを実行する。次の`<commit>`は、対象branchで確認した40桁の値へ置き換える。

```sh
npm run editor:media:handoff -- --source content/projects/example.mdx --branch content/example --commit "<commit>" --assets .local/media-plan.json --output .local/draft-media-handoff.json
```

CLIは`origin/content/*`の取得済みrefを優先し、なければ同名のローカルbranchを照合する。未保存の作業ファイルから本文を採らず、指定commitの本文hashと参照画像を固定する。用途・寸法・容量・変換は共有媒体処理を使い、写真の非可逆変換には計画内の`allowLossy:true`を必要とする。技術図は可逆変換する。出力先は私有作業領域に限り、ファイルをGitや公開CI artifactへ追加しない。この準備結果の`uploaded:false`は、まだR2に保存していないことを表す。

### CLIで登録する

実行端末の既存GitHub CLI認証を使用する。認証済みならCMSをブラウザーで開く必要はなく、毎回のログインや新しいtokenの作成を要求しない。`gh auth status --hostname github.com`で状態を確認できる。CLIは認証profileやscopeを自動変更しない。

```sh
npm run editor:media:register -- --input .local/draft-media-handoff.json --receipt .local/draft-media-receipt.json
npm run editor:media:register -- --input .local/draft-media-handoff.json --verify-only
```

一つ目は全画像を検査してから、固定CMS APIで原稿・画像参照を照合し、容量予約・revisionと旧画像hashの比較・upload・実bytesの再取得を行う。同じhashの登録済み画像は再確認して再利用する。二つ目は新しいprocessから読み取りだけで復元を確認する。登録済みというレポートだけを読まず、全参照画像の実bytesとhashを照合する。

GitHub認証値はプロセス内と固定APIへの送信にだけ使い、引数・ログ・receipt・ファイルへ保存しない。APIも認証値を永続化しない。接続失敗時に別originへ転送せず、CookieやCloudflareの管理認証で代用しない。本人以外、別repository、古い原稿、想定と異なる画像・revisionは拒否する。認証が失効した場合だけ、利用する実行端末のGitHub認証を再接続する。

`--verify-only`の成功は実Draftの保存・再取得を示す。CMSの端末cache更新、Astroレビューの表示、公開用媒体の保存や記事公開とは別の結果である。CMSでは同じGit下書きを開き直すか「別端末の画像を復元」を使い、対象commitのAstroレビューを確認する。

### CMSから登録する

CMSからファイルを渡す場合は次の順に行う。

1. CMSの「下書きの続き」で、準備した原稿と同じブランチ・版を開く。
2. 画像パネルの「AI原稿の画像をまとめて登録」を開き、「原稿の画像ファイル」で引継ぎJSONを選ぶ。
3. CMSが原稿と全画像を照合したら、「下書きに画像を登録」を押す。
4. 全画像の保存と実bytesの再取得・hash照合が終わり、本文の画像が表示されることを確認する。
5. 同じGit下書きを新しい端末内下書き、または別の認証済み端末から開き、参照画像をすべて復元できることを確認する。登録時の端末cacheだけで復元完了とはしない。
6. 対象commitの「Astroレビューを取得」を実行し、参照画像がすべて解決され、正規レイアウト内に表示されることを確認してCMS引継ぎを完了する。

AIが利用できる接続済みブラウザーに所有者のCMSセッションがあれば、同じファイル選択・登録操作も使える。ブラウザーの認証がないことだけで準備完了に止めず、先に登録CLIの既存認証を確認する。ブラウザーCookieの抽出、新しい長期token、R2への直接書込みは行わない。準備ファイル自体は認可証ではない。CMSはowner session・CSRF、CLIは所有者のBearer認証をそれぞれ検査し、同じDraftの媒体予約・アップロード・再取得を通す。

登録時にはrepository、ContentId、path、branch、commit、本文hashと全assetIdを再検査する。途中で本文、作業ブランチ、Gitの先頭が変わった場合は止め、読み込んだファイルで新しい原稿を置き換えない。同じassetId・hashが保存済みなら実bytesを再確認して再利用する。異なる画像へ差し替える場合だけ、計画に`expectedRemoteSha256`として取得済みの旧hashを指定する。既存画像とそのhashが違う場合や、端末に未同期の変更がある場合は上書きしない。

途中で失敗しても、確認できた画像は保持する。同じファイルで再実行すると保存済みの画像を照合して残りを続ける。版が変わった場合は最新版を確認して引継ぎファイルを作り直し、競合を無視して旧hashを書き換えない。必要な画像が一つでも未登録・取得失敗なら、本文だけ読めた状態と画像を含む引継ぎ完了を区別する。

## 公開準備

公開準備で必要な公開日・概要・権利・出典を確定し、既存の[記事制作手順](content-production.md)と[公開CI](article-media-publication-ci.md)へ引き渡す。CMSの保存やPRのReady操作は本人承認ではない。正式候補・実A/B/C保存・保護・export・通常CIの条件を満たしてから、別途認可された本番配信を行う。すべての記事にAIの全制作工程を人間の手作業として要求しないが、根拠や権利の事実をAIが推測で承認しない。

## 実環境の接続

GitHub Appは対象repositoryだけへインストールし、Contents read/write、Pull requests read/write、Actions read、Checks read、Metadata readを必要範囲として設定する。Callbackは公開サイト同一originの`/editor-api/auth/callback`。client secret、暗号化session secret、webhook secretはGitやブラウザへ配布しない。ownerの数値IDを認可条件にする。

Cloudflareのeditor-api WorkerにはDraft専用bucketだけをbindする。公開site Worker・公開/原本/保護bucketへこのAPIの権限を流用しない。GitHub push activityの署名検証と参照/保持試験が終わるまではGC_ENABLEDをfalseとする。providerのresource/route/secret作成はXpotato-Server側の認可済み設定工程で扱う。

ローカル・CIの合成GitHub/R2成功は、実際のApp認証、R2へのreadback、iPhone実機や本番配信の成功とは区別する。現時点の設定・受入れ状態は[実装状態](../architecture/cms-implementation-status.md)を確認する。

初回接続の実コマンドと不足項目の確認は[GitHub/R2接続手順](editor-connection.md)を使用する。App IDも検証し、対象repository一つへのinstallation以外はsessionを発行しない。

## 記事種別・分類・連載の保存

原稿を選び直すときはヘッダーからホームへ戻る。ホーム上部の「分類・タグ」「連載」は原稿を開かずに利用できる。編集中の記事の情報・履歴は右上の記事メニュー、保存と確認はヘッダーの保存状態から開く。現在の原稿はホームの「編集中の記事に戻る」から再開できる。

見出し・本文・写真を一緒に移動するには、見出しの操作メニューから「見出しと本文をまとめる」を選ぶ。任意の範囲は最初のブロックの「ブロックを選んでまとめる」から末尾を選び、まとめる操作を確定する。グループ外側のハンドルで全体を移動し、操作メニューの「グループを解除」で個別のブロックへ戻せる。新規のグループは挿入メニューから追加する。構成パネルにはグループ番号と中のブロック数が表示され、そこから対象へ移動できる。

構成パネルは、段落・画像・数式・コードもSVGと短い内容で表示する。グループと中身は字下げと線で区別し、各行から本文の対応箇所へ移動する。ブロック間の＋は、操作中の箇所とPCのホバー位置に表示する。空の本文と末尾には「ブロックを追加」がある。

教育記事は記事またはメモに学習主題・対象読者・前提知識・学習目標を付ける。固定ページへ記事用タグや分類は書き込まない。目的・技術・話題タグは同じ正規taxonomyのkindで区別し、検索は表示名・ID・別名・説明を使う。新しい分類・タグは管理画面で追加してから記事に付けられ、記事情報から追加する従来の操作も使える。未知IDを自動補完しない。

連載は記事を登録する前に作れる。所属と読む順序は `content/registry/series/series.json` のContentId配列で管理する。公開サイトの目次・前後リンクは公開可能な記事だけから生成し、未公開記事の題名・件数・IDを表示しない。複数連載への所属が可能で、記事の公開日やファイル名で並べ替えない。

分類・タグと連載の管理画面では「作業場所を選ぶ」から保存先を開き、変更後に「Gitへ保存」「Draft PRを作成」と進む。端末の管理状態は記事とは別に保存される。「この端末」で作った変更をGitへ送るときは、先に接続して作業ブランチを選ぶ。既に読んだ内容から別の更新が進んでいたら、手元の変更を保持して最新版と比較する。

記事のGit保存は本文・追加taxonomy・連載・派生目録を同じ非forceコミットにまとめる。管理だけのGit保存は記事本文・目録を変更しない。どちらも連載変更には編集前のregistryを付ける。先に取得していない連載を消さないよう、別連載への独立した変更だけを三方向で統合し、同じ連載の並び・名称・所属が競合した場合は比較して解決する。

`content/registry/editor.json` は公開CMSシェルへ配布できるtaxonomy・部品契約に限定する。記事の題名・ContentIdの一覧は別の `content/registry/editor-content-index.json` に生成し、連載registryとともに認証後のAPIだけが返す。これらの一覧をブラウザ用モジュールへ直接importしない。

CMS以外でMDXを追加・改題・移動した場合、ツールinstallerのapply後、正式な出版patchの適用後は `npm run editor:manifest` を実行して派生目録も同じPRに含める。`content page create` と `content note create` は自動再生成する。`npm run editor:manifest:check` はtaxonomy・部品契約と記事目録の両方を検査し、通常の `ci:source:preflight` でも古い目録を拒否する。生成は公開・承認・配備を実行しない。

## 添削の表示とモバイル入力

本文上の印と添削パネルでは、指摘済み・修正案あり・解決済み・反映済みを確認できる。修正案は変更前と変更後を見比べ、「修正案を反映」で本文へ入れる。対象の文が既に変わって位置を特定できないときは適用せず、範囲を選び直す。色や差分の記号は表示用で、MDX本文に混ぜない。

新しく指摘するには、本文のブロックを選び、ブロック上部の吹き出し「指摘を追加」を押す。文章の一部を選択してから押すと、その範囲を対象にできる。添削欄の引用を確認して指摘を入力し、追加する。範囲を選択していない場合はブロック全体が対象になる。

「反映済み」などの状態ボタンを押すと、その箇所の添削が開く。「追加の指摘」から現在の文章へ新しい指摘を付けられる。以前の指摘と修正案は折りたたみを開いて確認する。追加しても以前の反映記録や本文は変わらない。

モバイルでキーボードを開く間は下部の構成・画像・添削メニューを隠し、入力位置が見えるようにスクロールを調整する。書式バーや管理フォームも含め、カーソル位置と選択範囲を保持する。実iPhoneの入力・IMEの受入れ状況は[CMS実装状態](../architecture/cms-implementation-status.md)を参照する。
