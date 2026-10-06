---
status: approval-pending
owner: operations
last_verified: 2026-10-06
---

# 方式B：実設定前の一括承認資料

方式Bの選択だけは本人承認済みです。以下は具体的な実設定・credential operationの提案で、まだ一件も適用していません。値の読み出し・表示を求めません。[設定JSON](production-settings-proposal.json) と [Server変更案](../design/adr/production-actions-server-change-proposal.md) がレビュー対象です。

## 承認対象

| 設定 | 具体案 | 権限・影響 |
| --- | --- | --- |
| main保護 | PR経由、GitHub Actions App15368発行の`result`/`offline-policy`成功、up-to-date、会話解決必須、adminにも適用、force push/delete禁止。他者approval0、Code Owner/last-push approvalなし | owner/adminのAdministration writeが必要。直接pushは止まり、本人のPRはCI成功後merge可能。現行PR65はbase更新時に追従・再CIが必要になる |
| Environment | `site-production`新設。selected branch `main`だけ、tagなし。reviewer本人`Xpotato1024`（GET確認ID190472511）、self-review許可、admin bypass禁止 | Environment管理権限が必要。本人dispatch→本人明示承認で実行できる。二者承認ではない。公開repoで利用可能だが、実設定後readbackと非production承認試験が必要 |
| token発行 | Cloudflare account-owned、allow1件、Individual Workers→xpotato-site→Editorのみ、追加policy/permission group0。最大90日、60日で更新、残存7日未満deploy禁止 | Cloudflareの発行可能なoperator Dashboard sessionが必要。deploy token自体にAPI Tokens Write等は追加しない。live Worker tag/permission/resource selector、status/期限を秘密なしreadbackで確認。旧広域tokenは再利用しない |
| secret保管 | 上記Environmentだけに`CLOUDFLARE_SITE_API_TOKEN`。非秘密変数はaccount ID、token ID、Worker tag、Editor permission IDの4件 | Environment Secrets/Variables writeが必要。本人が安全なGitHub UIで値を登録する案。AIは値を取得しない。repository Secrets/local永続env/ログ/artifactへ複製しない |
| lifecycle | 正常配布は同IDのactive/scope/期限をreadback。60日更新時は新token確認→Secret更新→旧IDrevoke/inventory不在/detail404 | 長期tokenの残存期間中の漏洩riskを受け入れる判断が必要。更新operationと独立revokeは本人の別認可。GitHub secret上書き/削除だけでCloudflare tokenは失効しない |

Repository現在値はGET監査でpublic/User owner、main protected=false、rulesets=[]、environments=0。本人GitHub既存接続はadmin=trueですが、このread能力/権限だけをwrite承認と扱いません。Secrets値は読みません。

main設定は[GitHub REST仕様](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection)の`PUT .../branches/main/protection`にJSONの`mainProtection`を使う提案です。Environmentは[REST仕様](https://docs.github.com/en/rest/deployments/environments#create-or-update-an-environment)の`PUT .../environments/site-production`に`reviewers`/`prevent_self_review`/`can_admins_bypass`/`deployment_branch_policy`、branch policyの別APIでmainだけを指定します。どちらもまだ送信していません。reviewerLogin/name/secretNames等の設計metadataはAPI本文へそのまま送らないこと。設定前にはfresh GETで変更を再確認し、既存設定を上書きしないこと。

## 安全性と限界

PR検査はGitHub-hosted runner、read権限、full-SHA action、checkout persist-credentials=falseで、Environment/Secretsを参照しません。必須offline-policyはpath filterなしで全PRに走ります。将来のsecret使用はmainの手動dispatch・本人Environment承認を通ったproduction jobだけです。Environmentだけで悪意のあるmain workflowを防げるわけではなく、main/CI保護を併用します。本人GitHub admin資格情報の侵害による保護改変を完全に防ぐ案ではありません。

Individual Worker EditorにはR2 bindingを追加できるdeploy能力が残り得ます。R2 API権限なしはhard isolationではありません。漏洩tokenでCloudflare APIへ直接操作すればGitHub保護を迂回できます。accepted configとfresh provider前後のbindings=0、endpoint false、exact artifact、期限・監査・独立失効/containmentは必須ですが、この残存riskをゼロとは説明しません。

## この一括設定承認に含めないもの

workflow有効化、production deploy、DNS/R2/media/C-lock/permissions追加、redirect/publication hold解除、self-hosted runner登録、JIT撤去は対象外です。Server側の禁止変更のreview/merge、actual authenticated adapter・本人承認証跡・独立revoke/containment supervisorの実装と非production実証、fresh保護readbackを先に必要とします。本番workflowは3jobともliteral falseで、secret読み出し/実deploy adapterは未接続です。

この資料への承認が得られても、本番enable/deployは別の具体operation承認を必要とします。正式Actions経路が最低1回live acceptanceを通るまではJIT例外を撤去しません。

actual adapterの未解決権限も確認が必要です。現在のowner接続で行ったGET監査は、productionのread-only `GITHUB_TOKEN`でmain保護詳細を取得できる証明ではありません。また個別Worker Editorだけでtoken全policy detailやrevokeを読める/実行できると仮定しません。必要なreadbackは独立operator authorityで実証し、deploy tokenにAdministration/API Tokens等の追加権限を付けて解決しないこと。無人brokerの新設や追加の長期admin credentialはこの提案の承認対象外です。方式Bは毎回のtoken発行を省きますが、本人承認や独立containment/revokeの準備を省くものではありません。
