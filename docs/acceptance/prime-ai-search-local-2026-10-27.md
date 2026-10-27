# PR120: 数値の訴求と公開仕様のローカル候補（2026-10-27）

状態: ローカル候補検証時の記録。後続の既存Draft PR120へのcommit・pushが認可されました。PR本文変更・本番公開は対象外です。出発点はSite `a8ab7c4b8872ba80882f3b21affa394cc186a621`。toolkit/engine/vendor/公開metadata/robots/provider設定は変更しない。

## 画面と本文

「実験コアの一次記録 → 100桁 / RSA-100・約37分 → 入力して試す → 記録・現行の条件」の順とする。先頭の数値には「過去の実験版の1試行。現行公開版の速度保証ではありません」を隣接表示する。角丸カードの反復やAI専用schemaは足さない。

ツールの後ろには常時読める静的HTMLを置く。数値の受付条件は選択中のhash検証済みmanifestから既存formatterで生成し、入力欄へ入る文字数・正規化後の桁数/bit数・完了保証を分離する。将来の拡張仕様は表示しない。

- 表記の検査は4096文字まで。HTML input自身にmaxlength属性はなく、貼付けできることは計算受付の証明にならない。
- 共通parserは正規化後1024桁まで受理するが、公開adapterが100桁かつ332bit以下を再検査する。
- 通常経路は2^128未満。高精度/大メモリのrunnerも共通SIQS契約の100桁/332bitを再検査する。
- 100桁の2^332も333bitのため拒否。101桁の偶数と1e100も公開UIで拒否、Worker生成0。先頭0を除く202文字の97は2桁として受理。
- 時間上限は通常60秒、高精度600秒、大メモリ3600秒。高精度の手動設定は最大6 Worker/予算768MiB、大メモリは最大5 Worker/予算1536MiB。予算と実使用量、WASMとブラウザ全体のRAMは別。
- probableは素数証明ではなく、未解決の余因子も素数とは限らない。

入力の短い境界試験はtask evidenceの `current-limits-20261027.{mjs,json}`、実公開UIの拒否確認は `live-limits-20261027.{mjs,json}`。大きい数の長時間計算はしていない。

## 訴求に使える公開一次記録

[公開記録（固定snapshot）](https://github.com/Xpotato1024/browser-prime-toolkit/blob/99133842d311d944d09f258bd29afd3d17ba9514/docs/benchmarks/llm01-wide-window.md)。
[測定code](https://github.com/Xpotato1024/browser-prime-toolkit/tree/d1e0b865d14b702bd633fd739e05b2d3c772a1c1)。
[run](https://github.com/Xpotato1024/browser-prime-toolkit/blob/99133842d311d944d09f258bd29afd3d17ba9514/docs/benchmarks/staged-wide-window-stage38/completed/run.json)。
[原本hash索引](https://github.com/Xpotato1024/browser-prime-toolkit/blob/99133842d311d944d09f258bd29afd3d17ba9514/docs/benchmarks/staged-wide-window-stage38/completed/evidence-index.json)。

- 測定head: d1e0b865d14b702bd633fd739e05b2d3c772a1c1。2026-10-21、headless Chrome 155.0.8059.39 / WSL2 Linux、Core i7-9700K 3.60GHz。host logicalCpus=6、browser cores=6。
- 入力: RSA-100、100桁/330bit。N=1522605027922533360535618378132637429718068114961380688657908494580122963258952897654000350692006139。
- 5 Worker（coordinator込み）、manual WASM予算1536MiB、plan上限1280MiB、3600000ms、1試行。
- requestWallMs=2220175.200000018（約2220.175秒）。初回ページロード時間の値ではない。
- 結果probable / remaining=1。因子37975227936943673922808872755445627854565536638199 と40094690950920881030683735292761468389214899724061。
- 公開されたgzip/base64を復元し、1,090,337 bytes、SHA256 d79e353bc8e056a999f09aeae047f4da21cfca8477bbbd389e2a1ce3c3118e6d を索引と照合した。原本のCPU/browser/input/Worker/時間/確度を読んだ。会話中の37分から推定した値ではない。
- 公開版0.1.5とは測定版が異なる。現行Site、全100桁、他端末、他ツールとの優劣に一般化しない。selected-wide入口の後続機能試験はRSA-100再完走/改善未測定と明記されている。

[指定Zenn記事](https://zenn.dev/menhera/articles/58245043ec1ab7)のブラウザ97桁実測、384bit程度の生成・実行対象の記述を確認した。「100桁唯一」「世界最速」「普遍的に勝つ」は採用しない。同条件比較の原本がないため速度比を作らない。

## 次のtoolkitタスクに渡す範囲

現在の固定repoはXpotato1024/browser-prime-toolkit、v0.1.5 / 99133842d311d944d09f258bd29afd3d17ba9514。[PR36](https://github.com/Xpotato1024/browser-prime-toolkit/pull/36)がMERGED。今回読取時mainも同SHA、open PRなし。

LLM-01のprimary cloneは `C:/Users/miyut/Documents/Codex/2026-10-15/task/browser-prime-toolkit`。cleanだが古いbranch `codex/private-exact-ui-20261019`、HEAD723878f67dc120d84d28c315960a82e87a61f4bf。既存integration worktreeの.gitは/mnt/c絶対pathでWindows Gitから解決しない。新しいnative隔離worktreeを現在mainから準備し、古い作業を上書きしない。今回clone/worktree/toolkitは変更していない。

変更の接続点（toolkit sourceの.js）:

- src/site/mount.js: input/GUI、現在は経過時間等の表示。計算割合を偽って足さない。
- src/site/session.js: prepare/start/cancel/terminal state。heavy runnerのonProgressを現在GUIへ接続していない。
- src/optimized/runner.js とsrc/selected-wide/runner.js: onProgress({families,relations,target,memory,collectorStats,timings})。Worker protocol version21のbatch/submitted/extracted/fatal等を検査。
- src/rusqsieve/contracts.js: 100桁/332bit、packetの幅やtransport検査。src/site/policy.js、capabilities.js、session.js/heavyViewのinput/factor長も同期が必要。
- src/engine/staged-plan.js: 128bit経路。src/core/integer-input.jsは1024桁parserであり、そのまま分解能力を表さない。
- src/graph-multicore/policy.js、wide-window/policy.js、budget.js、memory.js: 有限Worker/WASM/time/quota。
- src/ui/result-view.js とsession.js/heavyView: 停止理由・因子確度・残余を表示。現在はJS文字列検査で、単一のTypeScript ProgressEvent/StopReason型はない。

安全な拡張案は3層を分ける。

1. 表記を受理して整数に直す層（現行1024桁parser）。ここだけ増えても「分解対応」と訴求しない。
2. 有限の小因子/完全冪処理で大きい値を扱う層。例えば2^1000のような容易な入力の完了と、残余の未解決/未証明を別表示する。現行公開経路ではまだ未実装。
3. SIQSで平衡半素数に挑む層。次候補を384bit等にする場合もnativeの整数幅/parameter表、packet/factor長、検算費用、OOM/取消/退役を先に確認し、時間・メモリを無制限に増やさない。今回受理/完走を主張しない。

progressは「準備・関係収集・行列処理・因子検算・退役」のphaseと実カウンタを先に公開し、relations/targetを全体の完了率として扱わない。時間予算の消化率と分解進捗も分離する。終了原因はtime-budget/cancel/input-range/設定不成立/WASM quota/coordinator soft-stop/native resource/transport/Worker/検算/退役不明を区別し、ブラウザタブ強制終了まで確実に説明できるとはしない。

## 発見・登録・Google AI

2026-10-27のGSC提示画面で対象URLの「Googleに登録されています／インデックスに登録済み」と有効なパンくずを親担当が確認。現在を未登録継続とは扱わない。Google選択canonical/最終crawl/ライブ取得HTMLの詳細は未提示。AIモードへの引用・採用は別。

同日の通常EdgeとNode標準fetchではhome/tools/対象/robots/sitemapが200。対象はself canonical、noindexなし。過去のurllib403は別client/時点で、実Googlebotの拒否や現在のWAF原因を証明しない。PDFにもHTTP logはない。

robotsには一般Allowとsitemap宣言があり、sitemap-0.xmlには対象がある。home→tools→対象は通常aリンク。Astro sitemap integrationが公開routeのbuild時にXMLを生成するため、新しい公開内容のbuild/deployに併せて更新される。発見導線の不足は確認しておらず、追加の手動URL登録やrobots変更を要求しない。

Google-Extended/GoogleOtherのlive拒否はCloudflare管理部分。repoのrobots生成は一般Allow＋sitemapのみ。検索AIモードはGooglebotとsnippet/index eligibilityの対象であり、Google-Extended拒否を今回の原因とは断定しない。[Google公式](https://developers.google.com/search/docs/appearance/ai-features)・[Google-Extendedの定義](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended)。特別なAI markup/llms.txtは追加しない。

## 今回のローカル検証

13件の関連テスト、typecheck、Astro check（0 error / 0 warning）、build、静的HTMLゲート、固定budget gateを通過。最終distでEdgeの360/12/97、JS無効時の本文、1280/390/320px表示と横はみ出しなしを確認。独立scoped prime acceptance（30 interval、Worker退役等）および390px/200%のaxe・guide QAを通過。mobile390pxでは追加した実績見出しの下、入力欄上端約591px。実績を先に出すため従来位置より下がるが同じ初期画面で入力できる。今回の変更後にfull release全体の再実行・新head CIはしていない。旧a8ab7c4のCI成功を今回候補のCI成功として扱わない。証拠はtask evidenceのai-seo-20261027内。

## 追加のrelease確認

2026-10-27、remote main `fb8d2b420c31c407adfa5f5190d10c1ad5a0e127` の全workflowを再取得。deployはworkflow_dispatchのみで、push/PRからdeployを起動しないことを確認。PR120はDraft、対象作業ブランチは `codex/prime-search-discovery-20261026`。

追加full test: 729 pass / 7 fail / 2 skip（738件）。7件は先に未変更baselineで再現した同じテストとエラー（symlink EPERM 4件、content reviewのCLI終了/timeout 2件、mock publicationのUNKNOWN 1件）で、今回の関連13件は成功。ci:finalは各isolation、static、budget、固定tool readiness、Phase8を通過し、release browserのprivate draft/content review成功後に既知の `A4 private localhost` timeoutで停止。scoped primeの30 interval/退役/モバイル/200%/axeは別途成功済み。全release browser QA成功とは記載しない。Hosted exact-head CIでLinux producerの全release graphとWindows consumerの結果を確認する。

独立read-only review: レイアウト・可視本文・生成HTML・validator/test・公開一次記録を再照合し、blocking findingなし。独立担当はテスト/ブラウザを再実行していない。将来modeごとに上限が分かれる場合は補足説明も再調整する。
