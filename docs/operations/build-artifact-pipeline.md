---
status: canonical
owner: operations
last_verified: 2026-09-28
canonical_for:
  - vNext source validation and build graph
  - immutable production release artifact
  - artifact acquisition and handoff validation
---

# ビルドとrelease artifactのpipeline

## Lifecycleと権限境界

[ADR-0033](../design/adr/0033-build-once-risk-scoped-delivery.md)のbuild-once設計を、producer、package、CI consumer、current docsまで実装しました。完全な実装を含む最初のmerged `main`から`IMPLEMENTED / ACTIVE`です。PR artifactは候補であり、同じsource SHAであってもproduction用へ昇格しません。

このpipelineはbytesを検証・保存しますが、Cloudflare credential、provider mutation、publication、production deploy、cutover、publication hold解除を認可しません。現行deploy workflowは[owner/main/manual/Environment/Production-artifact guard](current-deployment-status.md)で制限します。provider authorityとlive-operation gateは[Infrastructure Handoff](../architecture/infrastructure-handoff.md)および[Deployment Boundary](deployment-boundary.md)を正とします。

## CI producerと実行graph

`.github/workflows/ci.yml`はpull requestと`main`へのpushで動きます。Hosted Linux producerがsiteを1回buildし、同じoutputでfinal validationを実施してからrelease packageにします。Windows consumerはそのpackageを検証し、siteを再buildしません。

実行順序の唯一のownerはroot `package.json`です。

```text
release:produce
  -> ci:source
  -> build
       -> build:site (Astro)
       -> search:build
       -> security:generate
  -> ci:final
       -> static output validation
       -> Phase 7 / Phase 8 consumer
       -> release interaction check
  -> release:package
```

`npm run ci` / `release:produce` はlocalの完全経路を保持します。localではsource preflight・単体/release testの後に型/repository/Astro検査と完全fixture準備を並行実行し、両方の終了とGit HEAD復元を待って公開buildへ進みます。

Hosted CIでは同じexact source SHAを別checkoutで4本並行に検査します。commandの内容は `package.json`、jobの起動とstable resultは `ci.yml` が所有します。

- `source-validation`: `ci:source:validate`。既存preflight、全単体/release test、型/repository/Astro検査。
- `publication-fixtures`: `ci:fixtures:lifecycle`。初回候補・mock保存/export/cleanupと本文/題名/hero/category/tagsの5更新をすべて実行。private候補buildであり公開buildは0回。
- `common-tool`: 独立worktreeの実siteをbuildし、共通Toolのadoption、CSP、通信、操作を検査。private buildは1回、公開buildは0回。
- `producer`: `release:validate:hosted`。実際のauthoring/review/visualと初回publicationの非公開fixtureを生成してから、公開buildを1回実施。同じdistへ全final検査を行います。publicationの限定modeは5更新だけを別jobへ移し、初回候補・mock source/public/protected・export・job削除後render・承認後変更拒否・leak receiptを残します。架空のmarkerだけを置く方式ではありません。

producerは公開検査後、`ci:hosted:gate` でGitHubの読取り専用APIにより上記3jobの**同じrun/attempt/sourceのcompleted-success**を確認します。その後だけ `release:package` を実行し、従来どおりimmutable artifactへ保存します。API失敗、別repo/PR/base/source/workflow/attempt、欠損・重複job、失敗/取消/対象外はPASSへ変換しません。待機は最大25分。tokenはこのgate stepだけに渡し、build/browserへ渡しません。一般的なscheduler、別runの成功cache、中間dist転送は導入しません。失敗jobだけの再実行で同attemptの必須jobが揃わない場合は停止するため、復旧時はworkflow全体を再実行します。

source job完了前に公開buildの計算を始めることがありますが、未検証のdistをreleaseとして保存・昇格しません。stable `result` も3独立job・producer・Windowsの全成功を要求します。Production consumerのcompleted-successful main run条件、source SHA・run/attempt・artifact ID/digest、Windowsの再build禁止は変更しません。

final browserはcarousel desktop、carousel mobile、remainingを独立Chrome/profile/serverで並行実行します。desktop/mobileを分けても6秒autoplayなどの実時間assertion、motion/viewport/axe条件は同じです。common Toolは上記の独立jobへ分離し、public reportを `mode: public` と明記します。localのdefaultは全4suiteを実行します。reportはfresh run identityと成功exit receiptの全組を要求し、古い・欠落・別suiteのreportや部分成功を合成PASSにしません。共通Toolのprivate distには専用のCSP/通信検査を行い、公開distのCSP検査は公開suiteで保持します。

`release:package` は検証済みoutputをコピーするだけでbuildしません。Phase 7 / Phase 8は同じ `apps/site/dist` をconsumeします。保留Blogの `phase8:preview` / `phase8:held-preview:check` は明示的なprivate previewで、通常release graphへ含めません。

Prime PWAの再起動検査は同じ検査用profileだけを使い、復元タブを閉じて対象pageが1つであることを確認します。許可loopback origin/空タブ以外は失敗させ、利用者profileは使いません。更新待機・取消・rollback・cache消去の条件と期限は維持します。

入力はreviewed source、root lock、pinned toolchain、content/schemaとsite registryです。通常buildはAI API、R2 media download、Cloudflare API、外部metadata取得、private Article Job workspaceに依存しません。HTMLとMiniSearch indexは同じsource/distから生成し、別revisionのindexを混在させません。

CIは`RUNNER_TEMP`配下の絶対pathを`XPOTATO_RELEASE_TEMP`（browser profile）、`XPOTATO_PHASE8_TEMP_ROOT`（local serving/private preview）、`XPOTATO_RELEASE_PACKAGE`（fresh package出力）へ設定します。local検証でも前二者をtask temp配下へ明示し、必要なら`CHROME_PATH`でChrome/Edge executableを指定します。local buildはproduction candidateを作りません。

security-header policyはbuilt HTMLと実行script/styleから`apps/site/dist/_headers`を生成します。配布する正本はこのgenerated fileであり、tracked source `_headers`を第二SoTとして残しません。final static validationは同じoutputとheadersを検査します。

### Docs-only分類

`scripts/ci-scope.mjs`は全changed pathが対象Markdownまたは明示許可したREADME/AGENTSファイルの場合だけprose-onlyとします。許可READMEにはvendor全体の配置説明である`vendor/README.md`を含めますが、個々の固定配布物内のREADME/NOTICEやvendor bytesは含めません。`docs/migration/**`、`docs/architecture/infrastructure-handoff.md`、unknown path、machine-readable / executable inputはcore validationへ送ります。prose-onlyでもclassifier、source laneとexecution-graph regressionは動き、stable result jobは`NOT_APPLICABLE: prose-only change; site build count=0`を記録します。この場合はnpm install、site build、Windows artifact consumerを省略します。省略はPASSではありません。

同じPRの新しいheadが到着した場合だけ古いCI runを中断します。main pushはrun ID別のgroupを使い、別のmain runを中断・流用しません。依存はsetup-nodeのlock-keyed npm download cacheを`npm ci --prefer-offline`で利用し、lock integrity検査とfreshなnode_modulesは維持します。test PASS、private fixture、dist、release packageを別revisionのcacheから流用しません。測定と短縮幅の扱いは[CI時間の測定](ci-performance.md)を参照してください。

Phase 4/5/7/8の重複readiness workflowをなくし、そのsource-level gateを`ci:source` / `ci:final`へ統合します。Phase 6はmedia inputに応じるworkflowを保持し、legacy reproductionとvisual-baseline workflowも関連sourceのpath gateを保持します。`scripts/conditional-scope.mjs`は対応するnpm commandと参照先command、toolchain/dependency、workflowの対象pathの変更を確認し、無関係な`package.json`編集では重い検証を省略して`NOT_APPLICABLE`を記録します。分類不能なら検証を実行します。

## Release packageとidentity

packageのdeploy layoutは次の通りです。

```text
apps/site/dist/          検証済みstatic assetsとgenerated control files
apps/site/wrangler.jsonc deployに使う唯一のexact config
release.json             producerとvalidationのprovenance
```

`apps/site/wrangler.jsonc`の`assets.directory`は`./dist`です。config、environment、CLI override、build hook、overlay、検証後rewrite、別writerでstaging内容を変えません。

[`schemas/release/release-package.schema.json`](../../schemas/release/release-package.schema.json)が`xpotato-site-release-v1` (`schemaVersion: 1`)を定義します。`release.json`はrepository、source SHA、Server authority SHA、workflow name/path、run ID/attempt、Git ref/event、producer OS、Node/npm/Wrangler version、config path、source/final validation結果、`productionEligible`、該当run attemptへの参照を記録します。GitHub artifact IDとAPIのSHA-256 archive digestは外部artifact identityであり、`release.json`が自己申告する値ではありません。

producerは`.github/workflows/ci.yml`のHosted Linux runだけです。`productionEligible=true`になるのは`push`かつ`refs/heads/main`の場合だけです。pull-request artifactは常にcandidateです。Production取得ではGitHub APIからrepository、producer workflow、source SHA、run/attempt、artifact ID、digest、completed-successful runを全て照合します。

artifact retentionは90日です。artifactがmissing、expired、取得不能、またはidentity不一致なら停止し、別runを流用したり、同じreleaseとして再buildしたりしません。許可期間内のtransfer retryは同じartifact ID/digestに限定します。長期保管・rollback用copyは承認済みの保管手順で同一bytesとidentityを保ちます。

別認可のproduction operationではconsumerの非secret identity recordをoperation記録へ保存し、active / rollback candidateごとにartifact ID、API digest、source、run/attempt、expirationを保持します。期限前に必要な保管期間を判断し、長期保管が必要なら別途認可されたGitHub Release assets等へraw ZIPとprovenanceを同じbytesで保存し、再取得digestと保存先asset IDを記録します。本実装のconsumerはGitHub Actions artifact取得を扱い、失効済みartifactの別保管先への自動fallbackやRelease uploadは実装・実行したと扱いません。

packageへsource、`node_modules`、private media、credential、log、任意実行scriptを含めません。通常経路にUID canonicalizerや独自deploy-tree manifest/hashを使わず、GitHub API digestをpackage identityに使います。ADR-0032とacceptance evidenceは歴史として保存し、書き換えません。

## Windows consumerとhandoff

Windows PowerShell 5.1 consumerはsite dependencyのinstall/buildなしでLinux artifactを扱います。

```powershell
powershell.exe -NoProfile -File ./scripts/release/artifact/Get-ReleaseArtifact.ps1 `
  -Mode Candidate `
  -RunId <workflow-run-id> `
  -RunAttempt <attempt> `
  -ArtifactId <immutable-artifact-id> `
  -SourceSha <40-character-sha> `
  -ExpectedDigest sha256:<api-reported-digest> `
  -OperationRoot <fresh-absolute-operation-path>
```

`-Mode Production`はproduction eligibilityとcompleted-successful `main` runを追加確認します。artifact取得・検証のmodeであり、Wranglerを呼ばずproviderを変更しません。`Test-ReleaseConsumer.ps1`はconsumer fixtureを検査し、`Test-SiteArtifactHandoff.ps1 -OperationRoot <path> -ArtifactId <id> -RunId <run> -RunAttempt <attempt> -ExpectedDigest sha256:<digest> -SourceSha <sha>`は取得時と同じ外部selectionを引数で再固定し、選択済みpackageの最終handoffを確認します。local identity recordを編集して別artifact IDを選び直すことはできません。

consumerはimmutable artifact IDで取得し、GitHub APIから外部identityを確認します。展開前にraw ZIPのSHA-256をAPI digestと照合し、warningだけでは続行しません。freshな絶対operation rootへ安全に展開し、path traversal、absolute/drive path、link/reparse escape、unexpected entry、unsafe expansionを拒否します。rebuild、header normalize、UID rewrite、hook実行、別writerによる編集はしません。別認可operationでWranglerへ渡す直前に`Test-SiteArtifactHandoff.ps1`を一度実行し、stagingのpath/bytesを検証済みarchiveと照合してexact configとrelease recordを確認します。検査後に編集・別packageへの差替え・CLI/config overrideを挟まず、返されたconfig/assets pathをそのまま使用します。差分やidentity不明はfail-closedです。

handoff recordにはartifact ID、API digest、source SHA、workflow run/attempt、validation resultを一緒に残します。sourceとpolicyが不変の間はsource-bound evidenceを再利用できます。provider state、credential、authorization、preimageなどのlive evidenceはmutation直前にfreshに確認します。Server authority pinは`ab9328c5a58082ac1ec268aa7d5901d838a6a474`のままで、Server `main`の無関係な前進はbindingを置き換えません。

## 条件付きgate、cleanup、rollback

通常site CIはCloudflare APIやremote mediaに依存しません。media processing、frozen legacy reproduction、visual/performance baseline、provider check、production acceptanceは別々のconditional gateであり、通常build成功はそれらの成功を意味しません。

隔離済み・非secret・非productionの一時pathをpolicyが削除拒否した場合はWARN/P2として記録し、そのpolicyを迂回しません。内容不明、secret、productionへ効く残存物、path escape、容量riskは該当operationをBLOCKします。artifact missing/expiredは取得をBLOCKし、新しいcandidateまたは認可済みcompatible recovery artifactが必要です。

rollbackは同じidentity規則で既存のimmutable releaseを選びます。旧revisionの再buildは新しいcandidateであり、過去の承認済みartifactの再現ではありません。rollbackもcurrent endpoint-suppression、exact config、credential、provider、明示authorization gateを満たす必要があります。適合するreleaseが見つからなければ停止し、lifecycleに沿って新しいrecovery candidateを用意します。
