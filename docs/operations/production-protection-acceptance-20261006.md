---
status: github-settings-readback-pass-approval-test-pending
owner: operations
last_verified: 2026-10-06
---

# GitHub保護設定：2026-10-06の適用とreadback

本人が具体案のmain保護・空Environment設定・非配布承認テストを承認しました。token発行/保管・本番enable/deploy・JIT撤去は含みません。設定直前のGETではmain protected=false、rulesets=[]、environments=0を再確認し、他の設定を上書きしていません。

## 適用済み・別GETで確認済み

- main：PR経由必須、`result`/`offline-policy`をGitHub Actions App15368へ限定、strict/up-to-date、adminにも適用、force push/delete禁止、会話解決必須。他者approval0、Code Owner/last-push approvalなし。
- Environment `site-production`、ID `23583819406`：本人`Xpotato1024`のみrequired reviewer、prevent_self_review=false、can_admins_bypass=false。selected branch **mainのみ**、tagなし（branch policy ID `62139859`）。
- EnvironmentのSecret/Variableはどちらも0件。値を読み出さずmetadata countを確認しました。Cloudflare tokenは発行・登録していません。

main保護は公式RESTへのPUTで適用し、別GETで検証しました。最初のrequestは`checks`と`contexts`の併記が422で拒否され、設定は変わりませんでした。公開REST資料のclosing-down記載に従って`checks`だけへ修正し、App ID付きの2checkがreadbackで確認できました。

Environmentのcreate/update REST資料には`can_admins_bypass` request fieldが掲載されていません。初回の実応答がtrueだったため、同じ公式Environment更新endpointへfalseを指定し、そのPUT実応答と**独立したGET**の双方でfalseを確認しました。一般的なAPI保証とは扱わず、将来も必ず実GETで確認し、field欠落/trueならSTOPまたは本人の公式UI操作＋readbackを必要とします。推測した別endpointは使っていません。

## 非配布承認試験は未実行

`.github/workflows/environment-approval-check.yml`はreview用branchに用意済み。mainへの取り込みはまだ行っていません。本番deploy workflowは3jobともliteral falseです。

承認試験workflowは手動dispatchだけで、本人・main・exact repositoryのcontextを確認し、Environment承認後に固定PASS文字列を出します。checkout、Secrets、artifact、build、Cloudflare API、Wranglerを一切使いません。mainに存在するreview済みworkflowを採用後、本人の既存接続でdispatchし、Environment承認待ちのrun URLと本人の「Review deployments → site-production → Approve and deploy」操作を返します。ここでのボタン名はGitHubのUI名であり、本workflowの実処理は配布を行いません。

main専用EnvironmentへPR branchからdispatchして通す、branch policyを一時緩める、管理者bypassで試験を通す方法は使いません。取り込み前のため現時点で承認run URLはありません。設定の承認だけでPR66全体のmergeを代行しません。

main保護のrequired `offline-policy` はPR66で全PR実行のworkflowを追加しているため、PR65等はそのmain採用後のbase追従/再検証が必要になり得ます。設定は本人の運用を永久blockしないPR approval0ですが、未採用workflowのcheckを捏造して通しません。

非秘密のローカルreadback evidenceはtask evidence directoryの`approved-settings-readback.json`。この過去の記録を将来のdeployment直前のlive保護readbackとして再利用しません。
