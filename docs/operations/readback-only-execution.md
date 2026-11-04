---
status: proposed
owner: operations
last_verified: 2026-11-04
---

# 再配備しない既配信artifactの確認

専用CLI/workflowの実装と合成検査を用意した段階です。merge、workflowの有効な実行、credentialの実供給、live readback、人の受入れは未実施です。この文書やworkflowの存在は実行認可ではありません。

## 固定した対象と異なるidentity

`config/readback/robots-20261104.json`は、旧run `41796192558`がacknowledgeしたdeployment `37b96468-9f6b-40b9-919a-048f09b2a6b2` / version `e703f19c-6a7c-4fb4-94f5-558d0ef179ab`を検査するplanです。

- Production artifact: run `41794598566` / attempt `1` / artifact `13305566511` / source `108917dabc9774ea4a76a358f3225c912de26f47`。
- artifact digest: `sha256:a09fc6f7d57b07edaecc283efc818abbfb0c20740b64e5bf7c73acd19350676a`。
- 旧runの非秘密証跡artifact: `13305743848`。保存済みraw ZIPのSHA-256は `80d35109ee80ed72302733c03e7c3387c2f8c6fadcac158e3a91de28cac642ee`、11340 bytes。
- `manual-result.json`: `bd23fe6b82fc13aee602791931753d16504cae261369ccfa31165fd025a9d825`、94167 bytes。
- libraryの先行独立review revision: `1d741a93d4918d9dab792ed27d726749d3233084`。これは新CLI/workflow全体のreviewや実行認可の代わりではありません。

raw ZIPのpinは保存済みファイルをローカル照合した値です。実行時にはGitHubの認証済みmetadataのdigest/size/retention/所属runとも一致することを要求します。違えば停止し、別artifactや再包装したZIPへ切り替えません。

旧artifactは既配信の検証対象です。実行するverifierは、その時点でreview済みmainの別SHAです。通常deployのsource parityは変更せず、旧artifactを新しいcodeで配信する許可にはしません。新しいGitHub run / operation UUID、verifier SHA、plan hash、旧receiptとartifact/sourceを別々に記録します。元failureは変更しません。

## 入口と保護

`.github/workflows/site-readback-only.yml`は`workflow_dispatch`だけです。push/PR/schedule/他workflowの完了では起動しません。本人actor/triggering actor、main、初回attempt、明示的なreadback承認、入力verifier SHAと実run SHAの一致をjob guardとCLIの双方で要求します。`site-production` Environmentの既存本人承認・main限定・admin bypassなしをAPIでも確認します。既存deployと同じ`site-production` concurrency groupで直列化し、cancel-in-progressはfalseです。

permissionsは`contents/actions/checks: read`だけです。新しいcredential・アクセスを作りません。既存GitHub tokenは同repositoryの固定GETと正規consumerへ、Cloudflare tokensは固定provider GETだけへ渡します。writer tokenも自身のverify GETだけで使用します。GitHub artifactの署名付きURLは許可したHTTPS object hostへのGET一回だけとし、Authorizationを転送せず、URL/生レスポンス/例外本文をログに出しません。

CLI `scripts/release/deployment/readback-only-cli.mjs`の実入口`main()`はenv/transport/process/adapterのoverrideを受け付けません。`runSyntheticReadbackCli()`は別の合成入口で、fake GitHub envやfixtureを使っても必ずsyntheticです。実入口のowner guardを拒否させる子process試験も行いますが、偽装envでlive stageを通しません。

## 将来認可された実行の順序

1. CLI/workflow全体の独立review、本人によるmergeとread-only operationの実行認可を別々に確認する。現在はいずれの外部操作も行っていません。
2. 対象versionが既に変わっていれば、このplanは使用せず、新しい対象と証跡をreviewする。provider観測の不一致をplan変更で自動修復しない。
3. review済みmainのexact SHAを`verifier_sha`とし、planのUTF-8/LF bytesのSHA-256を`plan_sha256`とする。新しいUUIDを`operation_id`に指定し、`readback_approved=true`で新規manual operationを本人が明示的に認可する。既存deploy workflowの再実行ではない。
4. 既存Environmentの承認を通す。既存の`CLOUDFLARE_SITE_API_TOKEN`、`CLOUDFLARE_SITE_MONITOR_READ_TOKEN`、accepted `CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON`がexecutor内部で供給可能であることを確認する。秘密値をtaskやログへ取り出さない。欠ければincompleteで停止し、新規発行/登録はこの手順に含めない。
5. checkoutはexact SHA、persist-credentials=false、full history、pinned Nodeだけ。npm install、site build、Wranglerは不要。実Git HEAD/clean treeも検査する。
6. GitHub run/required checks/Environment approvalとworkflowのexact bytesを確認する。元run/証跡artifactのmetadata・archive digest・安全なZIP構造・本文digestを検査する。
7. 既存`Get-ReleaseArtifact.ps1 -Mode Production`で正規取得する。metadata/digest/eligibility/safe stagingを維持し、旧sourceのheld manifest、handoff、`readPublicTargets()`を再利用する。取得後にGitHub admissionを再確認する。
8. readback-only libraryで前後provider snapshot、全126対象とsecurity headers、限定robots、alternate endpoints、staging/plan不変性、final token checkを実行する。既存120秒/requests/bytes/attempt予算を維持し、過去の長い観測をsuccessへ変換しない。
9. `site-readback-result.json`、`readback-input-receipt.json`、`readback-only-<UUID>.json`を新しいartifactへ保存する。保存不能なら成功にしない。upload対象にsource archive/staging/original raw evidence/credentialを含めない。

planの現在のSHA-256は `625a095f39f177d8e1dc2a63c2862be9e0acde658491cfb5ede1a17a39729d0a`です。実行前にreview対象bytesと再照合します。新しい認可済みmain verifier SHAとoperation UUIDは未定です。`config/readback/*.json`とworkflowはLF固定です。

## 結果の読み方と未実施境界

`READBACK_ONLY_CHECKS_PASSED`は全検査と必須結果保存が完了したというcomponent結果です。`evidenceMode=synthetic`はlive受入れになりません。live adapterの結果でも`acceptance=false`を維持し、人が結果と認可範囲を確認して受け入れます。UNREPORTED expiry、scopeLiveReadback=false等は隠しません。

`READBACK_ONLY_FAILED`は不一致/拒否、`READBACK_ONLY_INCOMPLETE`は不足する認証・取得/観測・timeout・保存失敗です。job skippedやworkflowの見かけの成功だけをreadback完了とみなしません。実行run、expected version、全stage、raw/origin hash、前後snapshot、final tokenの証拠を確認します。

実I/Oを伴う受入れ、認可済みexecutorでの既存credential供給、dispatch、provider readbackは未実施です。再配備、provider変更、credential/access変更、merge、Ready化、旧runの書換えは行いません。GitHubへの新しい証拠artifact保存は将来認可されたworkflowの記録であり、Cloudflare provider writeではありません。
