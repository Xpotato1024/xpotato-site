# Prime v0.2.5のUI更新候補

Toolkit Draft PR [46](https://github.com/Xpotato1024/browser-prime-toolkit/pull/46) の固定コミット `9cf35474d7b4b477d16fa9e3094450d9418cf3e7` を採用する。タグ・GitHub Releaseは作成しない。サイトのマージ・Ready化・本番公開はこの作業に含めない。

## 変更

- 分解式の枠内にコピーアイコンを置く。名前「結果をコピー」、44pxの操作領域、キーボードフォーカス、成功・拒否時の通知を維持する。
- 「結果の詳細」と「使い方・ヘルプ」を分ける。未完了・未証明の説明をToolkit側へ集約し、ページ本文との重複をなくす。
- サイト共通ヘッダーの検索欄を独立した列に収め、文字拡大時にも入力欄と送信アイコンを揃える。
- PWAのホーム画面・オフライン利用の利点と保存操作を、計算機の前に常時表示する。初回オンライン保存、ブラウザー差、保存する公開ファイル、保存しない入力・結果、削除・更新条件は一つの説明欄へ整理する。
- タイトル「素因数分解計算機」を維持し、descriptionと短い導入に「計算ツール」を自然に使う。Webアプリはホーム画面追加の文脈で説明し、検索語の羅列はしない。本文変更を手動編集記録のhashと固定ソースへ結び、凍結移行baselineは変更しない。
- 指定されたGitHub Issueの公開・秘密情報注意文だけを削除し、連絡先とリンクは保持する。

## 固定成果物

- source tree SHA-256: `9c66d80153d6bb3fc238d1d324bdb38c4f29c273632ce1d5a5b2278facba6576`
- lock SHA-256: `b99e423acd7deddc825ce270b29e4da7c6e4639f70833bb092fefda1567f4105`
- manifest SHA-256: `ba3dd586aa8082e9dbc52832083fddad739495589705243048307962511e2b42`
- artifact SHA-256: `100c11520b46fb3975429dbdaf95a590775f07d5e1b3e43f7699dde5cff0880f`

独立した2つのクリーンcloneによる97ファイルのビルド出力が一致する。既存v0.2.4との実配布差分はUI・固定フォント文字列・版・manifest/provenanceのみ。数値処理、Worker/WASM、資源制限、ライセンス本文はbyte一致し、変更していない範囲は既存の独立レビューを再利用する。詳細は同ディレクトリー配下の `prime-factorizer/v0-2-5-source-review.json` に記録する。

採用は共通installerのplan/apply/checkを使い、vendor・生成物は手編集しない。旧版とライセンス資産を保持し、ContentIdとrouteは変えない。

## 検証範囲

Toolkit固定headの870テスト・check、Chromium149のコピー成功/拒否・長い結果・320/390/1280px・CSS200%表示の7ケースは成功した。PRイベントの全CIは成功したが、pushイベントでは既存SIQS labの期限テストが1件失敗した。同一headのPRイベントでは同テストが成功しており、原因を断定せず [失敗ログ](https://github.com/Xpotato1024/browser-prime-toolkit/actions/runs/42515206540/job/128836619336) を残す。

サイトの最終統合ビルドでは、通常の全CIと実配布物の操作・PWA保存/オフライン試験を行う。モバイルはviewportエミュレーションであり、実機iOS/Android、実スクリーンリーダー、Safari/Firefox、OSクリップボードへの書込み、本番配信は新たに検証していない。
