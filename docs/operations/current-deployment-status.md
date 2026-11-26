---
status: canonical
owner: operations
last_verified: 2026-11-26
canonical_for:
  - current repository deployment workflow status
---

# 現在の配信workflowと認可境界

基準実装は `00b7c5ae23fdf441a60656aa9dc7089a36cb22e4` の [deploy-site.yml](../../.github/workflows/deploy-site.yml) と [workflow guard](../../ops/deployment/manual-deployment-workflow-policy.mjs) です。

- triggerは `workflow_dispatch` のみ。push・pull requestからdeployしません。
- 対象repository、本人actor/triggering actor、main、初回attempt、本人の復旧準備確認をjob guardで制限します。
- `site-production` Environment、直列実行、成功main producerのProduction artifact identity照合、exact config、preimage・read-backを要求します。
- ルート検査では[固定CMS counterpart](../architecture/infrastructure-handoff.md#cms接続の固定counterpart)が所有する `xpotato.net/editor-api/*` → `xpotato-editor-api` を許容します。公開サイトWorker宛てのルートと、公開ホストに重なるそれ以外のルートは拒否します。
- PRのcandidate artifactをProductionへ昇格しません。診断modeも明示dispatchです。
- この実装状況は、実行認可・live provider受入れ・資格情報の有効性の証明ではありません。操作ごとの本人認可とfreshな前後確認が必要です。

旧設計時点の `if: ${{ false }}` hard blockは現行deploy workflowの説明としては失効しています。ADR、acceptance record、auditなどの当時の記録は履歴として残します。`site-integrity-monitor.yml` 等の別workflowのgateはこの訂正の対象ではありません。

providerのexact counterpartと未成立条件は[Infrastructure Handoff](../architecture/infrastructure-handoff.md)、artifactのproducer/consumerは[Build Artifact Pipeline](build-artifact-pipeline.md)、権限の分担は[Deployment Boundary](deployment-boundary.md)を参照します。provider mutation、実記事公開、media永続化、旧44記事のhold解除、cutoverをこの文書やPRで認可しません。

## 2026-11-26 Draft画像CLIの本番反映と実画像登録

[PR #250](https://github.com/Xpotato1024/xpotato-site/pull/250)をmain `a45f3594a5975cf63c46f6f1eb367d1fbccfca5d`（tree `d35d7260b660653bfaf3f84573b47f6e4a75bb8e`）へ統合し、所有者の明示認可に基づいて編集APIを配備した。[PR CI 45731946954](https://github.com/Xpotato1024/xpotato-site/actions/runs/45731946954)、対象213試験・後続31試験、型検査・整形検査が成功した。独立レビューはP0/P1が0件で、既存の放置された媒体予約の復旧制約1件をP2としてPR本文に残している。

### APIの配備と読み戻し

固定Node 24.22.1 / npm 11.19.0 / Wrangler 4.151.3と[固定CMS Server counterpart](../architecture/infrastructure-handoff.md#cms接続の固定counterpart) `f37b677309de13597b442bb3a06d4e38da06b48f`を使い、既存Cloudflare認証で正式な `editor:connect check` → `connect` → `verify` を実行した。`connect`は1回、`connect` / `verify`はともに終了コード0だった。

providerの読み戻しでactive deployment `9bfd1494-9782-4d4e-b165-33b58d327d59`、version `713e0abe-a42e-446d-ad31-f6e64ef8ee1d`（version 7、traffic 100%、作成時刻 `2026-11-26T01:04:44.610997Z`）を確認した。既存の非公開Draft bucket・binding・route・5 secrets、公開Siteのbindings 0、GC false、workers.dev / preview URLs falseを維持した。新CLI入口の無認証応答は401 / `CLI_AUTH_REQUIRED`、既存の `/editor/` はAccessの302、`/editor-api/session` は200で接続設定済みだった。

静的CMSシェルを含むSiteは、下記PR #247/#248の配信済みsource `536691b39c071fbd9f4d57dfcbe36d6655b28b40`を継続し、このAPI更新に伴う静的Siteの再配備は行っていない。

### 非公開Draftの4図

統合済みCLIをUbuntu 24.04で実行し、既存GitHub CLIの所有者認証でXpotato Site下書きの4図を実Draftへ登録した。新しいログインや資格情報の発行は行っていない。登録receiptは `2026-11-26T01:06:16.120Z`、終了コード0、`registered=4 / reused=0 / verified=true`。Draft ID `1069b528-7eb2-4c2e-b644-9e905bd8d050`、revision 5へ保存された。

対象はContentId `325e1e0e-acd3-469f-a27d-476cf84b48fc`、ブランチ `content/xpotato-site-product-20261126`、head `5efb70af61c2e3b07a1a46dd12586c4e8d19549f`の `content/projects/xpotato-site.mdx`。原稿のSHA-256は `0cd8db75a5a94cc5692142ae3d7bf13a37131d53360b97a1755f987a0e6b9a98` である。

| 図 | bytes | SHA-256 |
| --- | ---: | --- |
| architecture-editor | 40,606 | `143a2213fe8a6181294e660c2130076f9572d04ff777a6b907e82ce87dbb7b9c` |
| architecture-delivery | 50,014 | `b8321e1852a5a46f63e2cfa493a1f75bf91aea8c9e72d884d4836a3757dc3f93` |
| authoring-flow | 56,952 | `4f630e1aa7301570a02a31137355430ef38574a0de4ac01956b28c1889e52083` |
| media-lifecycle | 56,018 | `21f41bfe7ab42c1cd965af81c1e1d44fe4c3a359aad7da1f1b2fa36bc3365b3a` |

登録時の実bytes照合に加え、別プロセスの `--verify-only` が `2026-11-26T01:07:04.544Z` に終了コード0、`registered=0 / reused=4 / verified=true` で完了した。同じ原稿・head・Draft ID・revisionと4図のremote ID・サイズ・SHA-256を再照合した。これは実R2からの読み戻しであり、認証後のCMS画面・AstroレビューやiPhoneでの画像表示は未観測である。同じGitブランチから開き直すか、そのブランチの画像を復元する手順は[CMS制作手順](editor-workflow.md)を参照する。[記事PR #246](https://github.com/Xpotato1024/xpotato-site/pull/246)はDraft・未公開のままで、公開用A/B/Cへの保存や記事公開は行っていない。

## 2026-11-26 CMSの下書き引継ぎ修正を本番へ反映（PR #247/#248の記録）

[PR #247](https://github.com/Xpotato1024/xpotato-site/pull/247)のブランチ固定・私有画像の一括登録と、[PR #248](https://github.com/Xpotato1024/xpotato-site/pull/248)の保存済みGit下書きからのAstroレビュー取得を、所有者の明示認可に基づいて配備した。

### 静的CMSシェルを含むSite

[配信run 45719283922](https://github.com/Xpotato1024/xpotato-site/actions/runs/45719283922)はmain `536691b39c071fbd9f4d57dfcbe36d6655b28b40`の成功push CI [45718135308](https://github.com/Xpotato1024/xpotato-site/actions/runs/45718135308)、attempt 1から取得したProduction artifact `15070966992`（digest `sha256:fe625a39ab90c56650fec37ad961fe344226b725318544321d8b7eff5a67e6e9`）を使用した。再buildなし、配備1回で `DEPLOYED_READBACK_VERIFIED` となり、正規成果物の709対象の確認が完了した。内訳は本文・対象headerの一致292件、Access保護応答416件、固定robots policy 1件。

receiptのversion `e693f362-a484-4d0c-8e1b-32cfacbf2bfa`はreadbackのactive versionと一致し、active deploymentは `1b586f47-c1da-42cd-be45-e3e9647ed230`。公開Siteのbindings 0、Site自身のroutes 0、workers.dev / preview URLs falseを確認した。非secret証跡は同runのartifact `15072260366`（digest `sha256:cb70c7f32a6591b4ead1e5f9faac84d201f418ea3c7bc8bd154205f4b8ab39c8`）に保存されている。CMS保護パスの302はAccess境界の確認であり、認証後のHTML/JSのbyte一致とは区別する。

### CMS編集API

APIは統合済みsource `7d73c0426c3497219cfd70ed3437085487f8009b`と、[固定CMS Server counterpart](../architecture/infrastructure-handoff.md#cms接続の固定counterpart)を使い、正式な `editor:connect check` → `connect` → `verify` で更新した。固定Node/npm/Wrangler、clean checkout、既存認証・Draft bucket・route・5 secretsを使用し、`connect`は1回、`connect` / `verify`はともに終了コード0だった。後続の静的releaseとの差分にAPI・editor-core・portable-content・接続CLIの変更はない。

新active deploymentは `9c117868-238b-48a7-838e-c49e9e36059b`、versionは `c1ae310b-7cdd-43d9-9ec1-fdff3daa8031`（version 6、traffic 100%）。配備前のversionからの変化と、deployment / version一覧の一致をread-onlyで確認した。再検証ではsourceIsMerged、非公開bucket、Worker、route、GitHub secrets、connectionConfiguredがすべてtrue、GCはfalse。`/editor-api/session`は200、`/editor/`はAccessの302だった。

### CMS内の実操作との区別

このPR #247/#248の配備時点では、所有者CMSログイン、Xpotato Site下書きの4図の実Draft登録、新しい端末内下書きへの復元、認証後のAstro実表示は未実施だった。実Draft登録と別プロセスからの実bytes再取得は、上記PR #250のCLIによる実施記録で更新された。認証後の画面表示・端末への復元の未観測状態は維持し、下書きの引継ぎと非公開Draftの常時R/W認可は[CMS制作手順](editor-workflow.md)に従う。

## 記録済みの実施状態

記事mediaの初回設定と[74objectの実保存・照合](https://github.com/Xpotato1024/xpotato-site/actions/runs/41371394358)は完了し、[最初の3Dプリンタ記事](https://xpotato.net/articles/77arj41r5z8amrn46pdx71mknr/)は公開済みです。[配信run 41461513406](https://github.com/Xpotato1024/xpotato-site/actions/runs/41461513406)は配備1回後の公開bytes照合でfailureとなり、後続の読取りで本文・画像との一致を確認しました。ただし配信直後の不一致原因は未確定であり、公開済みという事実と配信runの検証完了を区別します。これは保存時・公開時の記録を整理したもので、新しいprovider観測や配信を実行した記録ではありません。

PR140の新しい配信manifest・状態分離・診断方式とPR141の配置整理はサイト側の実装・検査の変更です。mainへの統合は各PRのmerge SHAとCIで確認し、本番への適用とは区別します。手動配信と本番readbackが完了するまで、新方式の実rollout受入れを完了とは扱いません。旧44記事のhold、cutover、復旧受入れは初記事の公開とは別条件です。

[run 41787362572](https://github.com/Xpotato1024/xpotato-site/actions/runs/41787362572) はsource `265dadfd33cbf91c5d6099eb4f5aaf4d0fd8b117`で、配信前の`REPOSITORY_GUARD_PATH_OR_MODE`により停止しました。`deployment=not_attempted`、`deployCount=0`で、旧runの配備後不一致とは別の障害です。phase7/8 guardの移動先を通常比較が認識せず、現行package treeを自分自身と比較しても停止する不整合でした。修正コードのCI成功を、このrunの再実行や本番受入れとして扱いません。

## CMSのAccess保護下におけるProduction readback（2026-11-20）

[配信run 44719601350](https://github.com/Xpotato1024/xpotato-site/actions/runs/44719601350) はCloudflareへの配備が1回成功し、Workerの新versionを読み戻した後、公開readbackで `PUBLIC_HTTP_OR_REDIRECT` に停止した。未認証の `/editor/` がCloudflare Accessへ302リダイレクトされることを従来の200/本文SHA照合だけでは判定できず、別の `/articles/tag/troubleshooting/` は初回の本文SHAが一致しなかった。後続の独立したHTTP照合では当該記事が承認済みProduction artifactとサイズ・SHAともに一致した。

2026-11-20時点の修正では**`/editor/` のみ**、固定済みのCloudflare Accessチームホスト（`xpotato1024.cloudflareaccess.com`）、ログイン用パス、必須クエリ項目、元の `redirect_url=/editor/` がすべて一致する302応答を認証境界として許容した。その観測は `bodyMatch=cloudflare-access-protected` と明示し、**HTMLのbyte一致を証明したとは扱わない**。翌日の静的ファイルへの拡張は次節に記録する。

## 2026-11-21 CMS静的ファイルのAccess境界と本番readback

[manual deployment run 44859337802](https://github.com/Xpotato1024/xpotato-site/actions/runs/44859337802) は、成功したmain push CI run 44856616630のProduction artifact 14687339036（source 2abdd76d16f2dcd24d88f2a6f8e43627caca599c）だけを取得し、Wrangler deployを1回実行した。Cloudflareのversion receipt 654d31d2-ab48-43e6-b940-67b55659ff4a とread-only APIのactive versionが一致したが、公開後readbackはPUBLIC_HTTP_OR_REDIRECTにより失敗した。元runを成功とは扱わず、deployCount=1、rollbackExecuted=false、verification=failedの記録を保持する。

保存された非secret証跡には、全700対象のうち72件の観測がある。70件の本文・ヘッダーが一致し、`/editor/` の1件は想定するCloudflare Accessの302として認証境界を確認した。次の `/editor/assets/AstroReview-CIwfr59E.js` でもAccessの302を受けたが、旧`isEditorAccessChallenge`が `/editor/` だけを許可しており拒否された。未認証GETで `/editor/`・JS asset・`sw.js`・manifestの302について、チームホスト、login path、`redirect_url`が元pathと一致することを別に確認した。これは認証後のHTML/JS byte一致や全公開対象の受入れではない。

対応実装では、成果物のtarget planに含まれる /editor/ および明示したCMSシェルのHTML・JS/CSS・woff2・manifest・SW・iconパスだけに、従来と同じ固定チーム/login URL/kid/meta/exact redirect_url照合を適用する。これらはbodyMatch=cloudflare-access-protectedであり、公開bytesのhash一致ではない。未知のeditorパス、/editor-api/*、その他の公開サイト、別チーム・別URL・不正なredirectは従来どおり拒否する。失敗runへの後付けPASSは行わず、改善後のreadback受入れを別操作で確認する。

### 修正後の判定条件

| 観測した応答 | 判定 |
| --- | --- |
| 成果物内のCMS静的パスが、固定Accessログイン先へ元pathと一致する302を返す | 認証保護の検証成功。本文のSHA一致とは区別して記録する |
| 同じCMSパスを含む対象が200で読める | 本文サイズ・SHA-256・対象ヘッダーを照合する |
| 一般公開ページの認証リダイレクト、別チーム・別pathへのリダイレクト、APIや未知パス | 失敗 |
| 公開本文・ヘッダー・active Worker version・配備先の不一致 | 失敗 |
| 対象一覧の件数が以前の配備から増減した | 件数だけでは失敗にしない。正規成果物から生成した対象一覧の全件成功と検証前後の不変性を要求する |

再検証用の`cms-access-20261121.json`は、上記Production artifactと元配備のreceipt、証跡archiveの実bytes/digest、expected deployment/versionへ固定する。旧`robots-20261104.json`を暗黙に使わず、manual-only workflowで選択したGit内planとSHA-256を確認する。設定の追加・合成試験の成功は、既配備versionに対する新しい実readbackの完了を意味しない。

## 配備receipt後のversion反映待ち

Wranglerが新しいversionのreceiptを返してからCloudflareの読取りに反映されるまで、最大15回・90秒、再観測の間隔4秒で確認します。各回でWorker identity、active deployment/version、bindings、domain/routes、endpoint抑止を含む完全なsnapshotを取得します。既知のpreimageと一致する旧versionだけを待機対象とし、第三者のversion、異なるdeployment、Worker identityや設定のdriftは停止します。receiptと一致しても期限を過ぎたsnapshotは成功にしません。

通常のprovider読取り上限64回は維持し、反映待ちだけに12 GET×15回の独立上限180回を設けています。期限はこのphaseで固定し、各HTTP requestにも渡します。request自身の10秒上限より残り時間が短い場合は、残り時間で打ち切ります。反映待ちで公開readbackと最後のtoken確認の予算を消費せず、Wranglerの再呼出しや自動rollbackは行いません。

この方式の合成回帰検証は実provider adapter・GET応答・clockで行います。実Cloudflareでの再配備や、最新Production artifactの公開readback完了を示す記録ではありません。

## Cloudflare Managed robots.txt の公開bytes照合

公開後の照合は通常、artifactと応答本文のsize/SHA-256、HTTP 200、対象security/cache headersの一致を要求します。`/robots.txt`だけは、2026-11-04に公開GETで確認したCloudflare付加内容2676 bytes（SHA-256 `3073d1e371afb3271c7666148766fedc5145f7d8440f7114062db79b7bd58add`）と、既知の原本70 bytes（SHA-256 `cc7aa07ebda6b8ac79827a8b110a8941101ed035f58b2b26b677974683b7f9bb`）の連結も認めます。fixtureの出典・観測時刻・全本文は[固定capture](../../ops/deployment/fixtures/managed-robots-20261104.json)、検査は[限定policy](../../ops/deployment/managed-robots-policy.mjs)です。[Cloudflare公式説明](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)の例から許可本文を推測しません。

原本はwildcard `Allow: /`と自サイトsitemapだけです。固定prefixでも将来の原本の`Disallow`等と衝突し得るため、未知の原本、任意prefix、改行正規化、追加directive、他pathへの例外適用は拒否します。現在のprefixは`search=yes,ai-train=no,use=reference`とnamed botsの拒否を含み、全検索botの許可を意味しません。HTTP status・headers・version再確認・alternate endpoint抑止・既存の読取り予算は維持します。

新しい観測記録は`actual`に応答全体のsize/hashを保持し、`managedRobots.prefix`と`managedRobots.origin`を別記します。`bodyMatch=exact`は本文の完全一致だけを示し、Cloudflare設定の維持やedgeでのbot制御を証明しません。旧[failed run 41796192558](https://github.com/Xpotato1024/xpotato-site/actions/runs/41796192558)の証跡を書き換えず、この修正のローカル検証と本番readbackの完了を区別します。

新しいpolicy module/fixtureは既存source guardの保護対象です。それらを含まない古いartifactの再利用は`BUILD_OR_POLICY_SCRIPTS_CHANGED`で停止します。guardの例外は広げず、必要な新しいmain producer artifactの取得・配信は別認可の工程とします。

## 再配備しない既配信artifactの確認（library、live未実施）

`readback-only.mjs` は配信済みartifactを検証対象として扱う独立libraryです。通常のdeploy source parityやworkflow guardを変更しません。旧runのacknowledged receiptをreviewで固定したdigestの証跡ファイルと照合し、artifact selection、expected deployment/version/Worker identity、verifier SHAを別記します。canonical artifact adapterは既存PowerShell handoffと`readPublicTargets()`を再利用し、対象sourceのheld manifestをGit objectから読みます。正規Production取得済みoperation rootが先に必要です。

provider/publicの成功portや配信portは受け取りません。既存のGET限定provider adapter/public readerを内部生成し、正規成果物の全対象・headers・限定robots・alternate endpoint、provider前後snapshot、artifact/target/headerの不変性、final token identity/expiry evidenceを確認します。件数を旧126件へ固定せず、canonical consumerが照合した成果物全体から対象一覧を再生成します。root・robots・必須security headersと件数/bytes予算の条件も維持します。120秒phaseと既存のrequests/bytes/attempt予算を維持します。公開readbackにはalternate endpointの実statusも保存します。観測未完了と不一致を区別し、証跡は新しい`readback-only-<operation-id>.json`へ排他的に保存します。旧runのfailureを変更しません。

合成artifact/transport/clock/waitを使う結果は必ず`evidenceMode=synthetic`で、全stage通過も`READBACK_ONLY_CHECKS_PASSED`に留めます。`acceptance=false`はlive adapter使用時も維持し、人の受入れ判断を自動化しません。library import/handle作成だけでnetworkやcredential読取りは起きません。専用CLIとmanual-only workflowのlocal実装・合成試験を追加しましたが、実credentials供給・認可済みexecutorでの実行・live acceptanceは未実施です。[実行入口と未実施境界](readback-only-execution.md)に従い、exact revisionのreview、本人認可、既存Environment保護を通した新しいread-only operationとして扱います。

## 配信前source比較の所有範囲

実入口は`deploy-site.yml` → Production archive取得・初回handoff → `manual-deployment-cli.mjs` → `createManualGitHub.verify()` → CLI内の再handoff・公開対象検査 → providerのfresh preimage → 再検証 → 一度だけのWrangler呼出しです。最初のGitHub/source検査が失敗した場合、CLI内のhandoff以降へ進みません。外側のarchive取得・初回handoffはすでに完了し得ます。CLIの最初のhold manifest取得とartifact取得は読取りであり、配信ではありません。

| 対象                      | 比較・拒否条件                                                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rootの公開build・検証入力 | `apps`、`schemas`、`package.json`/lock、Node pinに加え、`tools`、`config`、`templates`、`vendor`、`tests`、TypeScript/Vitest設定とcheckout属性を比較。未分類の新しいrootも既定で比較し、片側だけの追加・削除・型/mode/hash差を拒否                                                                       |
| `packages`                | 現行4guardの正規所有先・regular blobを要求し、全leafのpath/mode/type/hashを一致させる。旧所有先との混在や移動の自動正規化はしない                                                                                                                                                                        |
| 歴史的な例外              | 旧4path/blob対とschema tree対は旧layoutの一方向遷移だけに固定。現行layoutの任意変更を許すhashへ書き換えない。layoutをまたぐartifact再利用は拒否                                                                                                                                                          |
| `scripts`                 | build・artifact consumer・共通transport・policyを比較。既存の配信操作コードだけは旧/現行の明示した完全パスで除外し、basename/globで無関係な同名ファイルを除外しない。現行操作依存の欠落・mode変更も停止                                                                                                  |
| docs・workflowの別境界    | 現行layoutの`.github` tree全体を比較。`docs`はこの運用状況ページ1件（通常ファイル必須）以外の全leafを比較し、機械検証用JSON・未知の追加文書も固定する。hold manifestとinfrastructure handoffの個別blob SHA一致、manual workflowのexact source、owner/main/attempt、main保護、Environmentの本人承認も維持 |
| archive・公開対象         | canonical PowerShell consumerのProduction適格性・digest・source/run/attempt・staging照合と、同じdistのpublication compiler/CSP/権利・保護来歴検査を維持                                                                                                                                                  |

`node --test ops/deployment/manual-deployment.test.mjs`は、旧hash対から作ったfixtureだけでなく、そのcheckoutの実Git treeを読んで実GitHub検査adapterと`runManualDeployment()`へ通します。GitHubの承認情報とhandoff/provider/deploy portsは合成であり、実資格情報やネットワークを使いません。移管先入力の変更、guard欠落・symlink、未知の同名scriptなどによる初回拒否ではCLI内handoff/provider/配信呼出し0を確認します。二回目のsource検査でのdriftは、最初のpreflight読取り後であってもpreimage保存・配信前に停止します。通常CIの実staged package/compiler検査とWindows consumerは別に実行し、合成試験を実provider preflightや本番rolloutの証明にしません。
