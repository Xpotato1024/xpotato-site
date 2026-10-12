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

このpipelineはbytesを検証・保存しますが、Cloudflare credential、provider mutation、publication、production deploy、cutover、publication hold解除を認可しません。`.github/workflows/deploy-site.yml`は`if: ${{ false }}`でhard-blockedのままです。provider authorityとlive-operation gateは[Infrastructure Handoff](../architecture/infrastructure-handoff.md)および[Deployment Boundary](deployment-boundary.md)を正とします。

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

`npm run ci`はlocal source -> build -> final validation用です。Hosted CIは依存をinstallした後に`npm run release:produce`を実行します。`release:package`は検証済みoutputをpackage化するだけでbuildを起動しません。Phase 7 / Phase 8の検査は同一`apps/site/dist`をconsumeします。保留Blogのmigration/publication準備では、既存production distを保持したまま`phase8:preview`、`phase8:held-preview:check`を明示実行し、private previewだけをtempへbuildします。これは通常release graphへ含めません。

入力はreviewed source、root lock、pinned toolchain、content/schemaとsite registryです。通常buildはAI API、R2 media download、Cloudflare API、外部metadata取得、private Article Job workspaceに依存しません。HTMLとMiniSearch indexは同じsource/distから生成し、別revisionのindexを混在させません。

CIは`RUNNER_TEMP`配下の絶対pathを`XPOTATO_RELEASE_TEMP`（browser profile）、`XPOTATO_PHASE8_TEMP_ROOT`（local serving/private preview）、`XPOTATO_RELEASE_PACKAGE`（fresh package出力）へ設定します。local検証でも前二者をtask temp配下へ明示し、必要なら`CHROME_PATH`でChrome/Edge executableを指定します。local buildはproduction candidateを作りません。

security-header policyはbuilt HTMLと実行script/styleから`apps/site/dist/_headers`を生成します。配布する正本はこのgenerated fileであり、tracked source `_headers`を第二SoTとして残しません。final static validationは同じoutputとheadersを検査します。

### Docs-only分類

`scripts/ci-scope.mjs`は全changed pathが対象Markdownまたは許可されたREADME/AGENTSファイルの場合だけprose-onlyとします。`docs/migration/**`、`docs/architecture/infrastructure-handoff.md`、unknown path、machine-readable / executable inputはcore validationへ送ります。prose-onlyでもclassifierとexecution-graph regressionは動き、stable result jobは`NOT_APPLICABLE: prose-only change; site build count=0`を記録します。この場合はnpm install、site build、Windows artifact consumerを省略します。省略はPASSではありません。

Phase 4/5/7/8の重複readiness workflowをなくし、そのsource-level gateを`ci:source` / `ci:final`へ統合します。Phase 6はmedia inputに応じるworkflowを保持し、legacy reproductionとvisual-baseline workflowも関連sourceのpath gateを保持します。`scripts/conditional-scope.mjs`は対応するnpm commandと参照先command、toolchain/dependency、workflowの対象pathの変更を確認し、無関係な`package.json`編集では重い検証を省略して`NOT_APPLICABLE`を記録します。分類不能なら検証を実行します。

## Release packageとidentity

packageのdeploy layoutは次の通りです。

```text
apps/site/dist/          検証済みstatic assetsとgenerated control files
apps/site/wrangler.jsonc deployに使う唯一のexact config
release.json             producerとvalidationのprovenance
```

`apps/site/wrangler.jsonc`の`assets.directory`は`./dist`です。config、environment、CLI override、build hook、overlay、検証後rewrite、別writerでstaging内容を変えません。

[`schemas/release-package.schema.json`](../../schemas/release-package.schema.json)が`xpotato-site-release-v1` (`schemaVersion: 1`)を定義します。`release.json`はrepository、source SHA、Server authority SHA、workflow name/path、run ID/attempt、Git ref/event、producer OS、Node/npm/Wrangler version、config path、source/final validation結果、`productionEligible`、該当run attemptへの参照を記録します。GitHub artifact IDとAPIのSHA-256 archive digestは外部artifact identityであり、`release.json`が自己申告する値ではありません。

producerは`.github/workflows/ci.yml`のHosted Linux runだけです。`productionEligible=true`になるのは`push`かつ`refs/heads/main`の場合だけです。pull-request artifactは常にcandidateです。Production取得ではGitHub APIからrepository、producer workflow、source SHA、run/attempt、artifact ID、digest、completed-successful runを全て照合します。

artifact retentionは90日です。artifactがmissing、expired、取得不能、またはidentity不一致なら停止し、別runを流用したり、同じreleaseとして再buildしたりしません。許可期間内のtransfer retryは同じartifact ID/digestに限定します。長期保管・rollback用copyは承認済みの保管手順で同一bytesとidentityを保ちます。

別認可のproduction operationではconsumerの非secret identity recordをoperation記録へ保存し、active / rollback candidateごとにartifact ID、API digest、source、run/attempt、expirationを保持します。期限前に必要な保管期間を判断し、長期保管が必要なら別途認可されたGitHub Release assets等へraw ZIPとprovenanceを同じbytesで保存し、再取得digestと保存先asset IDを記録します。本実装のconsumerはGitHub Actions artifact取得を扱い、失効済みartifactの別保管先への自動fallbackやRelease uploadは実装・実行したと扱いません。

packageへsource、`node_modules`、private media、credential、log、任意実行scriptを含めません。通常経路にUID canonicalizerや独自deploy-tree manifest/hashを使わず、GitHub API digestをpackage identityに使います。ADR-0032とacceptance evidenceは歴史として保存し、書き換えません。

## Windows consumerとhandoff

Windows PowerShell 5.1 consumerはsite dependencyのinstall/buildなしでLinux artifactを扱います。

```powershell
powershell.exe -NoProfile -File ./scripts/release/Get-ReleaseArtifact.ps1 `
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
