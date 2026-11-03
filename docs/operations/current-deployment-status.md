---
status: canonical
owner: operations
last_verified: 2026-11-03
canonical_for:
  - current repository deployment workflow status
---

# 現在の配信workflowと認可境界

基準実装は `00b7c5ae23fdf441a60656aa9dc7089a36cb22e4` の [deploy-site.yml](../../.github/workflows/deploy-site.yml) と [workflow guard](../../scripts/release/deployment/manual-deployment-workflow-policy.mjs) です。

- triggerは `workflow_dispatch` のみ。push・pull requestからdeployしません。
- 対象repository、本人actor/triggering actor、main、初回attempt、本人の復旧準備確認をjob guardで制限します。
- `site-production` Environment、直列実行、成功main producerのProduction artifact identity照合、exact config、preimage・read-backを要求します。
- PRのcandidate artifactをProductionへ昇格しません。診断modeも明示dispatchです。
- この実装状況は、実行認可・live provider受入れ・資格情報の有効性の証明ではありません。操作ごとの本人認可とfreshな前後確認が必要です。

旧設計時点の `if: ${{ false }}` hard blockは現行deploy workflowの説明としては失効しています。ADR、acceptance record、auditなどの当時の記録は履歴として残します。`site-integrity-monitor.yml` 等の別workflowのgateはこの訂正の対象ではありません。

providerのexact counterpartと未成立条件は[Infrastructure Handoff](../architecture/infrastructure-handoff.md)、artifactのproducer/consumerは[Build Artifact Pipeline](build-artifact-pipeline.md)、権限の分担は[Deployment Boundary](deployment-boundary.md)を参照します。provider mutation、実記事公開、media永続化、旧44記事のhold解除、cutoverをこの文書やPRで認可しません。

## 記録済みの実施状態

記事mediaの初回設定と[74objectの実保存・照合](https://github.com/Xpotato1024/xpotato-site/actions/runs/41371394358)は完了し、[最初の3Dプリンタ記事](https://xpotato.net/articles/77arj41r5z8amrn46pdx71mknr/)は公開済みです。[配信run 41461513406](https://github.com/Xpotato1024/xpotato-site/actions/runs/41461513406)は配備1回後の公開bytes照合でfailureとなり、後続の読取りで本文・画像との一致を確認しました。ただし配信直後の不一致原因は未確定であり、公開済みという事実と配信runの検証完了を区別します。これは保存時・公開時の記録を整理したもので、新しいprovider観測や配信を実行した記録ではありません。

PR140の新しい配信manifest・状態分離・診断方式とPR141の配置整理はDraftです。main・本番へ適用済みとは扱いません。旧44記事のhold、cutover、復旧受入れは初記事の公開とは別条件です。
