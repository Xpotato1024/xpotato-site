# 素因数分解機0.1.4の固定採用

`/tools/prime-factorizer/`、ContentId `bca48f98-c89a-457f-84d8-168f941fe469`、visible hydrationと既存手動登録を維持して更新する。受入済みの入力・操作・結果、入力例／実行条件モーダル、Siteのフォント・表示境界、SEO、canonicalだけを共有する共通部品、関連記事の仕組みを統合する。PR115の保留記事画像とPR116の登録方式移行は含めない。資格情報・権限・CSP・監視設定を拡張しない。

## 対応ソースと配布物

toolkit PR34のreviewed head `275b73dfcdd78ffbab8fd45f28c02538f494f9d0` は全18workflow／52checkが成功し、独立reviewはP0/P1/P2=0/0/0。通常merge `835f152ec8cf0b8dca5db1f469018a1780cf5c94` は同じGit treeを持つ。このmergeから2つのclean checkoutでbuildし、全78ファイル・5,047,924 bytesが一致した。

- artifact SHA-256: `bc1030b9ae836724817e75a747e0723d313d84e0c57c84065fd496904aa4e5a1`
- manifest SHA-256: `2e4e37305bf690d0bce962a4f035615c2218b7be3c3ec964b950e1dbb0f05ed9`
- source tree SHA-256: `c8bd7796c52758c816ce1df1ad0ab4ea843d928d28097a065c11485e11a035a3`

canonical adopt検査で全manifest entry、対応ソース、lock、LICENSE／NOTICE／SOURCE_OFFER／第三者通知・musl原文を照合する。能力情報は採用manifestとhashへ結合し、手書きの別表でruntime上限を変更しない。旧0.1.3候補との差はSOURCE_OFFER、manifest、package、adapter版表示の4ファイルだけで、残る74ファイルと数値・Worker・資源・依存・CSSは不変。0.1.4配布物のdesktop Firefox／WebKit各18ケースは成功した。ソースarchiveは全2,505 tracked filesと対応する。

## 未公開候補と失敗履歴

v0.1.3タグは `fa87c15b73777b8782edf2d57fadf32df90c478f` が `0c9017e15723a364c091b1147eae71acb17966cf` を指す状態を保持する。main CIは成功したが、タグCIはraw tag objectとcheckout commitの識別で計算前に失敗し、Releaseと添付配布物は作成していない。PR34でraw ref・object型・peeled commit・checkoutをすべて照合する。旧タグを付け替えず0.1.4を新規公開する。

Siteのv0.1.3 vendorはこの作業で作った未公開候補なので、全bytesを照合して正式選択から外す。旧公開v0.1.0〜0.1.2のvendor・pin・review・ライセンス原文は保持する。v0.1.3準備の記録は履歴として残し、公開実績へ読み替えない。

0.1.4 merge後mainの初回test jobはGMPの2つの固定URLへのcurl28接続タイムアウトで失敗した。識別とWASM確認は先に成功している。hash・URL・取得時間上限を変えず、run完了後に同じSHAの失敗jobだけを一度再実行する。各attemptをprovenanceへ残す。v0.1.2タグNative validationの初回失敗・同source一回再実行成功、原因未確定という履歴も保持する。

## 公開・配信gate

この文書の存在はRelease／Site本番配信の完了証拠ではない。最終main／tag CI、実際のtag targetに一致するsource/provenance、公開assetの匿名取得とsize/hash照合を要求する。Siteをpushする前に、取得した正式配布物とvendor／選択pinの一致を確認する。

Siteは最終sourceを固定し、全体・関連テスト、schema／型／build／性能予算／CSP／静的検査、正式ReactのFirefox／WebKit・狭幅／文字200%、Chromeの通信・Worker／Blob退役・複数instance／unmount／通常遷移、共有canonical／手動コピーとmetadata対応を検査する。tool stylesheetは実際の描画ページだけに配置する。独立reviewと最新CIの後に通常mergeし、成功main pushが作ったimmutable Production artifactを既存GitHub workflowで一度だけ配信する。PR artifactやlocal buildを昇格しない。providerのfreshな前後確認は既存workflowで行い、routine freshnessのためDashboard画像を再要求しない。

公開後は実ページの版・canonical・対応source・主要操作と、実asset bytesを読み戻す。実機iOS／Android、Safariアプリ、soft keyboard／autozoom、実BFCache、スクリーンリーダー、OS clipboard拒否画面、長時間・多Worker性能は未検証。desktop WebKitやviewport emulationを実機保証へ拡張しない。Site全体の完成、保留記事の公開、監視activationやincident解除は含めない。
