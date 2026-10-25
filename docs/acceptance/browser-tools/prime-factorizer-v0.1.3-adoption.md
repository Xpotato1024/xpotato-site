# 素因数分解機0.1.3の採用準備

既存の `/tools/prime-factorizer/`、ContentId `bca48f98-c89a-457f-84d8-168f941fe469`、visible hydration、手動登録方式を維持して固定版を更新する。Siteの受入済み表示・SEO・共有と組み合わせる。PR115の保留記事画像とPR116の生成登録移行は含めず、旧版のvendor・pin・review・公開ライセンス原文を保持する。

## 固定候補と実測済みの範囲

toolkit PR31は `08532f7b1397803c73a29ce848e77774a3857229` に通常マージ済み。受入候補 `1a33154909c261c413ffb45324d9c41c30a58e32` とGit treeが一致する。同候補の18workflow／52checkが成功した後にマージした。2つの独立clean checkoutとmerge後の追加buildで全78ファイル・5,047,234 bytesが一致した。

- artifact SHA-256: `f043fb85ef2ee9737c797df0f276edc94db7b69f50b6fe7c5236f2409edb31ee`
- manifest SHA-256: `1cbd9dc97b2bddf6319fac060e633bf55abfc4cbba4203424a5fac94558e884e`
- 77 manifest entryのsize/hash、LICENSE・NOTICE・SOURCE_OFFER・第三者通知・musl原文とsource対応を検査済み。
- `uiCapabilities` は同じ配布物のruntime定義と一致。Site表示はこの採用manifestとpinへ結合する。metadataのない旧版へ新しい説明を補わない。
- 全666テスト・`npm run check`、実0.1.3配布物のデスクトップFirefox151／WebKit26.5各18ケースが成功した。入力例は入力のみ、設定の適用／取消、IME、精度・上限、中止／Worker退役／再実行、コピー成功／拒否／非対応、狭幅／文字200%を検査した。
- 独立した受入済みUI・境界レビューと、版準備5ファイルの差分レビューはいずれもP0/P1/P2=0/0/0。配布物の実測はproducerによるもので、独立reviewerがbuildを再実行したとはしない。

正規adopt検査を通して `v0-1-3` を追加し、既存の明示manifest/CSS import、package/lock、source review、公開admissionとmusl公開原文を同じ候補へ接続した。fixture専用installerへ移行せず、一般のCSP・権限・設定を拡大しない。

正式React結合でtool CSSが共通ContentLayoutへhoistされ、ツールのない2ルートが既存CSS予算を超えた。選択CSSのURLだけを持つ `PrimeFactorizerStyles.astro` を各hydration rendererから描画し、実際に分解機があるページにだけstylesheetを読み込む。vendor bytes・表示変数・予算値は変えない。初期HTML・JSなしの読み込みと全ルートの実CSS bytesも確認する。

## 未完了のgate

本書はローカル採用準備であり、正式ReleaseやSite配信を完了とする記録ではない。PR31 merge後のmain CIではstaged lifecycleのChrome起動待ちが失敗した。計算前の失敗として履歴を保持し、CI専用修正・新しいfinal source／tag target・成功CIを別途確定する。最終のsource pinを実際のtag targetへ合わせ、公開Releaseを匿名取得してhashを照合するまでは本番採用へ進めない。

Siteの最終review・CI、通常merge、成功main pushのProduction artifact取得、既存GitHub workflow内のfresh provider確認とguard付き単発配信、公開assets／動作の読み戻しが必要。PR artifactやローカルbuildをProduction artifactへ昇格しない。既存のGitHub手動配信ルート・過去の成功記録と、ユーザーの設定変更なしの確認を採用し、routine freshnessのためにDashboard画像を再要求しない。ブラウザ操作ツールの不在を認証拒否と混同しない。

## 2026-10-25の実行記録と停止位置

PR33を通常マージした `0c9017e15723a364c091b1147eae71acb17966cf` はreviewed headとtreeが一致し、mainの9workflow／26checkが成功した。実際のmergeから2clean buildの全78ファイルが一致し、全2,504 tracked fileに対応するsource ZIPも検証した。ローカル候補pinはこのsourceへ更新した。これは正式公開版のSite採用を完了とするものではない。

`v0.1.3` のannotated tag object `fa87c15b73777b8782edf2d57fadf32df90c478f` はこのcommitを指すが、タグCIはraw tag objectとcheckout commitの識別で9workflowが依存取得・計算前に失敗した。v0.1.3 Releaseと公開assetsは作成していない。タグは保全し、[Draft PR34](https://github.com/Xpotato1024/browser-prime-toolkit/pull/34) で厳密なraw-ref／peeled-commit照合と次の0.1.4候補を準備している。通常PR化・mergeは別のDraft制限解除待ちで、公開・本番配信へ進んでいない。

Siteの77ファイル・712テスト、関連179テストと配信検査100テスト、typecheck／build／CSS予算／CSP／repository／static／Astro／固定pinの検査が成功した。正式React結合のdesktop Firefox／WebKitは各10ケース・10配置条件が成功し、独立視覚reviewに指摘はない。WebKitのスクリーンショット処理だけがinline-style CSP通知を発生させることをidle pageの撮影前0／撮影後1で再現し、撮影を分離した機能検査では通知0を確認した。CSPは緩めていない。

既存の配信前Chrome検査に残っていたtextarea・即時設定変更・非表示alertの前提を現在の結果欄／設定モーダルへ合わせた。修正前の実dist失敗、修正後の12ケース・30無通信区間、Worker／Blob解放、複数instance、React unmountと通常遷移、通信・CSP検出の自己試験を確認した。実表示の対応ソースURLとcapability manifest hashも選択pinへ照合し、古いbuildを最終受入と扱わない。これらのローカル検査をRelease／Site本番配信成功へ読み替えない。

実iOS／Android、Safariアプリ、実BFCache、スクリーンリーダー、OSのコピー拒否画面、長時間・多Worker性能は未検証。toolkitの単体受入を正式React結合や本番受入の代わりにしない。v0.1.2タグCIのNative validation初回失敗・同source1回再実行成功、初回原因未確定を保持する。Site全体の完成・記事hold解除・監視activation・provider設定変更を含めない。
