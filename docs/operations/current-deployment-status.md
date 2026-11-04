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

PR140の新しい配信manifest・状態分離・診断方式とPR141の配置整理はサイト側の実装・検査の変更です。mainへの統合は各PRのmerge SHAとCIで確認し、本番への適用とは区別します。手動配信と本番readbackが完了するまで、新方式の実rollout受入れを完了とは扱いません。旧44記事のhold、cutover、復旧受入れは初記事の公開とは別条件です。

[run 41787362572](https://github.com/Xpotato1024/xpotato-site/actions/runs/41787362572) はsource `265dadfd33cbf91c5d6099eb4f5aaf4d0fd8b117`で、配信前の`REPOSITORY_GUARD_PATH_OR_MODE`により停止しました。`deployment=not_attempted`、`deployCount=0`で、旧runの配備後不一致とは別の障害です。phase7/8 guardの移動先を通常比較が認識せず、現行package treeを自分自身と比較しても停止する不整合でした。修正コードのCI成功を、このrunの再実行や本番受入れとして扱いません。

## 配信前source比較の所有範囲

実入口は`deploy-site.yml` → Production archive取得・初回handoff → `manual-deployment-cli.mjs` → `createManualGitHub.verify()` → CLI内の再handoff・公開対象検査 → providerのfresh preimage → 再検証 → 一度だけのWrangler呼出しです。最初のGitHub/source検査が失敗した場合、CLI内のhandoff以降へ進みません。外側のarchive取得・初回handoffはすでに完了し得ます。CLIの最初のhold manifest取得とartifact取得は読取りであり、配信ではありません。

| 対象 | 比較・拒否条件 |
|---|---|
| rootの公開build・検証入力 | `apps`、`schemas`、`package.json`/lock、Node pinに加え、`tools`、`config`、`templates`、`vendor`、`tests`、TypeScript/Vitest設定とcheckout属性を比較。未分類の新しいrootも既定で比較し、片側だけの追加・削除・型/mode/hash差を拒否 |
| `packages` | 現行4guardの正規所有先・regular blobを要求し、全leafのpath/mode/type/hashを一致させる。旧所有先との混在や移動の自動正規化はしない |
| 歴史的な例外 | 旧4path/blob対とschema tree対は旧layoutの一方向遷移だけに固定。現行layoutの任意変更を許すhashへ書き換えない。layoutをまたぐartifact再利用は拒否 |
| `scripts` | build・artifact consumer・共通transport・policyを比較。既存の配信操作コードだけは旧/現行の明示した完全パスで除外し、basename/globで無関係な同名ファイルを除外しない。現行操作依存の欠落・mode変更も停止 |
| docs・workflowの別境界 | 現行layoutの`.github` tree全体を比較。`docs`はこの運用状況ページ1件（通常ファイル必須）以外の全leafを比較し、機械検証用JSON・未知の追加文書も固定する。hold manifestとinfrastructure handoffの個別blob SHA一致、manual workflowのexact source、owner/main/attempt、main保護、Environmentの本人承認も維持 |
| archive・公開対象 | canonical PowerShell consumerのProduction適格性・digest・source/run/attempt・staging照合と、同じdistのpublication compiler/CSP/権利・保護来歴検査を維持 |

`node --test scripts/release/deployment/manual-deployment.test.mjs`は、旧hash対から作ったfixtureだけでなく、そのcheckoutの実Git treeを読んで実GitHub検査adapterと`runManualDeployment()`へ通します。GitHubの承認情報とhandoff/provider/deploy portsは合成であり、実資格情報やネットワークを使いません。移管先入力の変更、guard欠落・symlink、未知の同名scriptなどによる初回拒否ではCLI内handoff/provider/配信呼出し0を確認します。二回目のsource検査でのdriftは、最初のpreflight読取り後であってもpreimage保存・配信前に停止します。通常CIの実staged package/compiler検査とWindows consumerは別に実行し、合成試験を実provider preflightや本番rolloutの証明にしません。
