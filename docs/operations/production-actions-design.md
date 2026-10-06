---
status: proposed
owner: operations
last_verified: 2026-10-06
---

# 正式Actions経路のreview用実装（実配布は停止）

[ADR0043](../design/adr/0043-production-actions-authentication-boundary.md)の方式B実装資料です。本人は期限付きのサイト限定token保管を選択済みです。main保護・空Environment設定は後続承認により適用/readback済みですが、credential・配布は未承認です。Server側は[変更案](../design/adr/production-actions-server-change-proposal.md)の別採用待ち。現行authorityは[Infrastructure Handoff](../architecture/infrastructure-handoff.md)、[Deployment Boundary](deployment-boundary.md)、[Build Artifact Pipeline](build-artifact-pipeline.md)のままで、本番workflowは3jobとも停止しています。

## 実行できる範囲

Node標準libraryだけでoffline検査を実行できます。Cloudflare token、依存install、site buildは不要です。

```text
node --test scripts/release/deployment-policy.test.mjs scripts/release/deployment-persistent-policy.test.mjs scripts/release/deployment-adapters.test.mjs
```

非秘密のrelease selectionを確認するCLIはGitHub認証済みのGETだけを使用します。

```text
node scripts/release/deployment-plan.mjs RUN_ID ATTEMPT ARTIFACT_ID SOURCE_SHA sha256:DIGEST ABSOLUTE_TASK_TEMP_OUTPUT
```

出力はsystem tempまたは`RUNNER_TEMP`の子に限ります。ID/SHA/digestを事前検査しshell interpolationを使いません。GET対象は固定repositoryのworkflow run attemptとartifact metadataです。成功しても`BLOCKED_CREDENTIAL_AND_LIVE_ACCEPTANCE`であり、archive取得/検証・provider操作・本番許可を意味しません。PRやfailed/pending run、違うworkflow/attempt/SHA/digest、expired artifactは拒否します。

## 将来adapterへ必要な非秘密evidence

`deployment-policy.mjs`のnormalized contractは**実provider responseの代わりではありません**。raw応答adapterはコード/mock検証済みですがlive接続は未実証です。認証済みadapterは raw APIとWorker identity/policyを独立に照合し、完全paginationとorigin/trustを証明してからこの形へ変換する必要があります。`true`を手書きしたJSONで本番gateを満たせません。

| evidence | 必須内容 |
| --- | --- |
| release | exact completed-successful main run/attempt/artifact外部digest、archive/stagingの既存Production consumer/handoff |
| provider preimage | account/Worker/script tag、active deployment/version/traffic、全bindings/routes、既存hostname、endpoint flags、HTTP bytes、実versionのalternate URLs、fresh timestamp |
| token metadata | B用は同account/token ID/Worker tag、live Editor permission ID1件、allow1/追加0、active、最大90日、60日更新必須、残存7日以上。既存JIT gateの直前発行/24h/即revokeは暫定JIT用に分離して残す |
| containment | deploy tokenとは独立したcapability、別の明示authorization、直前検証 |
| deploy/postimage | 単一実行、pinned Wrangler、exact config、変更なしstaging、providerのexpected deployment/versionとpublic byte一致、flags/bindings/domain/routes維持 |
| lifecycle | B正常時は同一tokenのactive/scope/期限をpost-readbackし保持。失敗/unknownはsame-ID emergency revoke receipt、完全inventoryで対象なし、detail404と独立containment。rotation時も旧IDの不在を別確認。expiry予定・process終了・403を失効証明としない |

stale、unknown、pagination未完了、R2を含むunexpected binding、wrong selector、endpoint exposure、version違い、staging差異はFAIL。Bのdeploy失敗でも独立sessionのrevokeを要求し、postcheck failureはrevoke後の独立containmentと再readを必要とします。検査はrollbackを認可しません。offline整合性結果は常に`acceptance=false`です。

B用の`deployment-persistent-policy.mjs`は上記token lifetime、main/Environment保護、actor/event/ref、artifact handoff、providerと失敗時失効を検査します。metadataや`true`が人間承認の本物の証拠とはなりません。main/空Environmentは承認後に適用して別GETで確認済みですが、Secretが0件なのでproduction custody gateはFAILするのが正常です。[適用記録](production-protection-acceptance-20261006.md)を参照してください。

更新の`assessPersistentRotation`は直前発行の新ID、別認可のEnvironment更新成功、更新後の旧IDrevoke/完全inventory不在/detail404を検査します。API Tokens Writeをdeploy tokenへ追加しません。検査合格はactual secret更新やtoken失効を意味しません。

## Action固定値

2026-10-06に公式repositoryの`git/ref/tags/v4`をGETし、object type=commitを確認しました。タグの将来変更へ追従せず、次のSHAを全workflowに固定しています。

| 公式action | full commit SHA |
| --- | --- |
| [checkout](https://github.com/actions/checkout/commit/11d5960a326750d5838078e36cf38b85af677262) | `11d5960a326750d5838078e36cf38b85af677262` |
| [setup-node](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020) | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| [upload-artifact](https://github.com/actions/upload-artifact/commit/ea165f8d65b6e75b540449e92b4886f43607fa02) | `ea165f8d65b6e75b540449e92b4886f43607fa02` |

## 今回未接続の箇所

- [コード/mock検証済みadapter](production-adapter-verification.md)とlive operator authority・採用済みselectorとの接続。
- GitHub OIDC native exchange（公式方式未確認）。
- main上の非配布Environment試験は[本人承認待ち](production-protection-acceptance-20261006.md)。production jobの本人承認証跡、期限付きtoken保管/更新は別認可待ち。self-hosted runnerは導入しない。
- 実Wrangler deploy bootstrap、独立revoke/containment adapterと既存operator環境で配布時だけ起動するcontrollerの接続・非production live実証。毎回一時operator tokenを発行する負担と既存認可sessionのAPI権限不足を[再評価中](production-adapter-verification.md)。新serviceや常設admin credentialは追加しない。
- 正式経路のoperation authorization、実運用acceptance、JIT撤去。

上記を持たない現状で、workflowの`if: false`を外してはいけません。Bで本人が別認可した場合のみEnvironment Secretを使用し、workflow input/output/artifactへ秘密値を渡しません。release-reviewはsecretなし、将来productionだけがEnvironment承認後にsecretを受ける構成です。artifactは承認後に再取得/再検証し、preimageはmutation直前に取得します。今回Cloudflare account/token、永続access、DNS/networkは作成していません。main/空Environmentだけを本人の後続承認により変更しました。
