---
status: proposed
owner: operations
last_verified: 2026-10-06
---

# 正式Actions経路のreview用実装（実配布は停止）

[ADR0043](../design/adr/0043-production-actions-authentication-boundary.md)の設計候補です。現行authorityは[Infrastructure Handoff](../architecture/infrastructure-handoff.md)、[Deployment Boundary](deployment-boundary.md)、[Build Artifact Pipeline](build-artifact-pipeline.md)のままです。正式認証は未選定で、本番workflowは2jobとも停止しています。

## 実行できる範囲

Node標準libraryだけでoffline検査を実行できます。Cloudflare token、依存install、site buildは不要です。

```text
node --test scripts/release/deployment-policy.test.mjs
```

非秘密のrelease selectionを確認するCLIはGitHub認証済みのGETだけを使用します。

```text
node scripts/release/deployment-plan.mjs RUN_ID ATTEMPT ARTIFACT_ID SOURCE_SHA sha256:DIGEST ABSOLUTE_TASK_TEMP_OUTPUT
```

出力はsystem tempまたは`RUNNER_TEMP`の子に限ります。ID/SHA/digestを事前検査しshell interpolationを使いません。GET対象は固定repositoryのworkflow run attemptとartifact metadataです。成功しても`BLOCKED_AUTH_DECISION`であり、archive取得/検証・provider操作・本番許可を意味しません。PRやfailed/pending run、違うworkflow/attempt/SHA/digest、expired artifactは拒否します。

## 将来adapterへ必要な非秘密evidence

`deployment-policy.mjs`のnormalized contractは**実provider responseの代わりではありません**。現状は合成fixtureのみ。将来の認証済みadapterは raw APIとWorker identity/policyを独立に照合し、完全paginationとorigin/trustを証明してからこの形へ変換する必要があります。`true`を手書きしたJSONで本番gateを満たせません。

| evidence | 必須内容 |
| --- | --- |
| release | exact completed-successful main run/attempt/artifact外部digest、archive/stagingの既存Production consumer/handoff |
| provider preimage | account/Worker/script tag、active deployment/version/traffic、全bindings/routes、既存hostname、endpoint flags、HTTP bytes、実versionのalternate URLs、fresh timestamp |
| token metadata | 秘密値を含めず、同account/Worker tag、liveで対応を確認したpermission group ID1件、allow policy1件/追加0、active、直前発行、有効なnot-before/expiry。24h以内expiryはbackstop、operational lifetimeは即revoke |
| containment | deploy tokenとは独立したcapability、別の明示authorization、直前検証 |
| deploy/postimage | 単一実行、pinned Wrangler、exact config、変更なしstaging、providerのexpected deployment/versionとpublic byte一致、flags/bindings/domain/routes維持 |
| revocation | 同ID revoke receipt、完全inventoryで対象なし、exact detail404。expiry予定・process終了・403を失効証明としない |

stale、unknown、pagination未完了、R2を含むunexpected binding、wrong selector、endpoint exposure、version違い、staging差異はFAIL。deploy失敗でもrevokeを要求し、postcheck failureはrevoke後の独立containmentと再readを必要とします。検査はrollbackを認可しません。offline整合性結果は常に`acceptance=false`です。

## 今回未接続の箇所

- Cloudflare認証・token取得のactual adapter、secret-free実policy selector照合。
- GitHub OIDC native exchange（公式方式未確認）。
- A案のisolated ephemeral runnerとsecure memory-only intake、runner登録/access制御。
- 実deploy、same-ID revoke、独立containmentの実行adapterとfail-safe supervisor。
- 正式経路のoperation authorization、実運用acceptance、JIT撤去。

上記を持たない現状で、workflowの`if: false`を外してはいけません。credentialをworkflow input/Secrets/output/artifactへ追加して欠落を埋めません。新しいaccount、token、永続access、DNS/networkを作成しません。
