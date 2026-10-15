---
status: canonical
owner: operations
last_verified: 2026-10-15
canonical_for:
  - current repository deployment workflow status
---

# 現在の配信workflowと認可境界

基準実装は `00b7c5ae23fdf441a60656aa9dc7089a36cb22e4` の [deploy-site.yml](../../.github/workflows/deploy-site.yml) と [workflow guard](../../scripts/release/manual-deployment-workflow-policy.mjs) です。

- triggerは `workflow_dispatch` のみ。push・pull requestからdeployしません。
- 対象repository、本人actor/triggering actor、main、初回attempt、本人の復旧準備確認をjob guardで制限します。
- `site-production` Environment、直列実行、成功main producerのProduction artifact identity照合、exact config、preimage・read-backを要求します。
- PRのcandidate artifactをProductionへ昇格しません。診断modeも明示dispatchです。
- この実装状況は、実行認可・live provider受入れ・資格情報の有効性の証明ではありません。操作ごとの本人認可とfreshな前後確認が必要です。

旧設計時点の `if: ${{ false }}` hard blockは現行deploy workflowの説明としては失効しています。ADR、acceptance record、auditなどの当時の記録は履歴として残します。`site-integrity-monitor.yml` 等の別workflowのgateはこの訂正の対象ではありません。

providerのexact counterpartと未成立条件は[Infrastructure Handoff](../architecture/infrastructure-handoff.md)、artifactのproducer/consumerは[Build Artifact Pipeline](build-artifact-pipeline.md)、権限の分担は[Deployment Boundary](deployment-boundary.md)を参照します。provider mutation、実記事公開、media永続化、旧44記事のhold解除、cutoverをこの文書やPRで認可しません。
