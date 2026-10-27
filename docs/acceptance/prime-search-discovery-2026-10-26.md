# 素因数分解機の検索向け静的情報と確認記録（2026-10-26）

対象baselineは `fb8d2b420c31c407adfa5f5190d10c1ad5a0e127`。これは調査時の origin/main であり、採用版は PRIME 0.1.5。検索順位・Googleの登録状態の原因を断定する記録ではない。

## 確認した事実

LLM-01の実Edge/Chromiumで公開URLを開き、CDPのDocument応答・redirect chain・HTML・画面を保存した。

| 対象 | 確認結果 |
|---|---|
| `/`、`/tools/`、`/tools/prime-factorizer/` | HTTP 200 |
| 分解機のmetadata | title=`素因数分解機 &#124; Xpotato`、H1一つ、既存description、日本語、self canonical。meta noindexとX-Robots-Tagなし |
| robots / sitemap | HTTP 200。一般検索向けAllow、sitemap-indexからsitemap-0へ到達し、canonical分解機URLを収録。AI専用制限は変更していない |
| 内部導線 | 通常のa要素でサイトのツール一覧→分解機へ到達。リンクをJavaScriptだけに依存していない |
| JSON-LD | 実際のWebPageと可視ナビゲーションに対応するBreadcrumbList。架空のレビュー・評価・FAQや速度保証なし |
| 未知のpath | 実HTTP 404 + noindex。探索した `/prime-factorizer/` も404だが、これを旧正式URLとは認定しない |
| 旧WordPress URL | **`/?p=34` はredirectせずホームのHTTP 200、canonicalもホーム** |

旧URLとの対応は [既存Toolのfrontmatter](../../apps/site/src/content/tools/prime-factorizer.mdx) の `legacyUrls: ["/?p=34"]` に記録されている。metadataに対応があることと、live redirectが実装されていることは別である。[SEO規約](../architecture/seo-discovery-policy.md)と[配信責務](../operations/deployment-boundary.md)ではquery/domain redirectはinfra所有。このPRでprovider設定やredirect ruleを操作しない。将来の別scopeでは、このexact queryから分解機canonicalへの恒久redirectを検討できる。

別クライアントのurllibがCloudflare 403/error 1010となった観測は、ブラウザの200と区別する。Googlebotの拒否・Googleの登録欠落を示す証拠ではなく、WAFやAI制限を緩和しない。

## 変更

baselineのTool MDXにはDemoと閉じた「結果が未完了・未証明のとき」の補足があるが、常時読める定義・計算例がなかった。ツールの後に、素因数分解の意味、360/12/97の例、操作手順、0/1、未完了・未証明の読み方を静的Markdownとして加えた。順位への影響は仮説であり、改善保証はしない。

移行済みMDXの全文hashを固定する既存契約を保持し、同じContentIdのhostにMarkdown companionを静的出力する。新routeや別の検索用ページは作らない。toolkitのGUI/core/vendor、固定版、公開admission、CSP、metadata、ContentId、分類、日付は変更しない。説明は入力・操作部の後で、先頭に目次を増やさない。

説明中のラベルは固定配布物 `vendor/browser-tools/prime-factorizer/v0-1-5/src/ui/result-view.mjs` の「確定判定」「未証明（probable）」に照合した。probableを素数証明と説明しない。入力形式と0/1の扱いは同版のinteger-input/resultおよび実ブラウザと照合した。

生成HTMLの回帰検査は、JSや閉じたdetailsの中だけに説明を置く誤り、canonical/noindex/H1、ツールと説明の順序、一覧リンク、sitemap、WebPageのidentityを検出する。6件のmutation testを追加した。

## 検証と限界

- Node 24.22.1 / npm 11.19.0。Windows checkoutのCRLFでimmutable manifest検査が止まったため、隔離worktreeの未編集fileだけをexact Git blobへ戻した。Git設定やimmutable sourceを変更していない。
- 新規6 tests、typecheck、repository validation、Astro check（errors/warnings 0）、4種のisolation prepare/check、build、static validation、asset budgets、Phase 7/8検査は成功。
- ローカル全testは724成功・7失敗・2skip。無変更baselineを別detached worktreeへcheckoutし、同じlockをoffline installして失敗を含む6fileを実行すると、**同じ7件が再現**（95成功/7失敗）。4件はWindows symlink EPERM、2件はCLI終了時SIGTERM、1件はmock publicationの `PUBLICATION_WRITE_RESULT_UNKNOWN_STOP`。このPRで無関係な処理や権限を修正していない。
- 標準 `ci:final` のrelease browserは `A4 private localhost` 待ちで停止。A2/A3まで成功したが、全release browser成功とは扱わない。prime専用の既存acceptance関数は独立scopeで別実行し成功した。
- 320/390/1280pxのブラウザemulationで横overflowなし。ツール上端は変更前後で同じ（390pxで393.33px）。360/12/97の実結果を確認し、JS無効でも説明が読める。
- 実機iOS/Android、Safari/Firefox、screen reader、field Core Web Vitals、Search Console、Google indexation/順位は未確認。ブラウザemulationやlocal labを実機・fieldの合格と扱わない。

詳細log、CDP記録、raw HTML、画面はLLM-01のtask用 `../site-prime-seo-evidence/` に保持する。rasterをGitへ追加せず、保留記事・画像の公開を行わない。

## 配信境界

調査時mainの `deploy-site.yml` はworkflow_dispatchのみで、push/PR triggerなし。他workflowのpush/PR処理はvalidation/候補artifactでありdeployを呼ばない。repository hooks APIは空、旧Workers Builds接続の解除記録とmainのchecksも確認した。Draft PRは配信認可ではなく、ready化・merge・deploy・indexing request・monitor/security/access変更は行わない。

## 最終のprime専用QAとlocal lab

既存の verifyPrimeToolInteraction を実dist・generated CSPで実行し、入力精度/境界、不正入力、0/1、offline、取消/deadline、Worker/Blob退役、複数instance/unmount、コピー拒否/非対応、通信検出器の自己試験を確認した。30計算区間でpage/Worker/CDP/HTTP/CSP違反は0。desktop/mobile/文字200%のaxeでは違反0（incomplete判定は原本に保持）。390px/文字200%でもdocument幅390px、横overflowなし。1280pxの先頭画面と390pxの全体画面を目視確認した。

| 同一条件の3回観測 | baseline main | この変更 |
|---|---:|---:|
| readyの観測時刻 ms | 13686.2–14070.2 | 13831.2–14073.4 |
| CLS（ready後600msまで） | 0.1505–0.1509 | 0.1449–0.1552 |
| 完了したresourceのencoded bytes | 2466173 | 2518648 |
| font requests | 53 | 57 |

条件は390×844/DPR1、CPU4倍slowdown、latency150ms、download200,000 B/s、cache無効、local gzip、実Edge/Chromium。repositoryのperformance-smokeをtask-privateに複製し、primeのdata-phase=ready待ちとその観測時刻を追加した。各sampleはpollingによる上限側の時刻であり、fieldの起動時間/INPやCDN速度ではない。初期描画だけのLCPは計算可能な状態を表さない。

既存の大きい固定tool bundleによる起動時間と約0.15のCLSはbaselineにもある。今回のJS entry参照はliveと同一で、runtimeは追加していない。日本語説明に必要なfont4件・encoded 52475 bytesが増えた。asset budgetは上限を緩和せず成功。検索順位への影響をこのlabから推定しない。toolkitのpayload/準備中表示の改善は別scopeで、今回変更しない。

画面原本のSHA-256:

- local-prime-1280.png: a799382e2cf24f8dd866c4d4a70c4251223d534f0b2eb9db29e3ca8fbabe518b

- local-prime-390.png: e7b8f52bff94210b5634313b9bff9579a874cbc03ddfc0978e8919502ea25ebb

- local-prime-guide-full.png: 34b863505999561a5a91895487eddf79eb3a2ff3beb120620fc7191cc52edd61
