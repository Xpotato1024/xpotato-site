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

## 非配布承認試験は本人承認待ち

承認テストと必須offline-policyの実検査だけを独立した[PR67](https://github.com/Xpotato1024/xpotato-site/pull/67)で取り込みました。head `cfeb3525c38e21f61c6c1b8dcf3729fc4d49aa02`の5check成功後、保護を迂回せず通常mergeしました。main commitは`27315274866481afcd771e820f6cbbd09be78479`。mainの[vNext CI](https://github.com/Xpotato1024/xpotato-site/actions/runs/37472324279)と[offline-policy](https://github.com/Xpotato1024/xpotato-site/actions/runs/37472324259)も成功しています。変更は3新規ファイルのみで、mainの本番workflowは元のliteral falseから変更していません。PR66全体は取り込んでいません。

承認試験workflowは手動dispatchだけで、本人・main・exact repositoryのcontextを確認し、Environment承認後に固定PASS文字列を出します。checkout、Secrets、artifact、build、Cloudflare API、Wranglerを一切使いません。mainに存在するreview済みworkflowを採用後、本人の既存接続でdispatchし、Environment承認待ちのrun URLと本人の「Review deployments → site-production → Approve and deploy」操作を返します。ここでのボタン名はGitHubのUI名であり、本workflowの実処理は配布を行いません。

2026-10-06T13:40Zに設定を再GETし、本人reviewer・bypass=false・main branchのみ・Secret/Variable各0を確認してmainからdispatchしました。[run37472667780](https://github.com/Xpotato1024/xpotato-site/actions/runs/37472667780)はexact main commit上でcontext成功、approval jobがwaitingです。pending_deploymentsでもEnvironment ID `23583819406`、reviewer本人、current_user_can_approve=trueを確認しました。本人への操作案内は「Review deployments → site-productionを選択 → Approve and deploy」です。承認POSTを代行していません。本人が操作して最終job成功を確認するまでは承認試験合格と扱いません。

main専用EnvironmentへPR branchからdispatchして通す、branch policyを一時緩める、管理者bypassで試験を通す方法は使いません。

mainのrequired `offline-policy` はPR67のNode標準ライブラリによる5境界検査で、全PRに対して実行されます。PR65/66にはmain追従/再検査が必要です。PR66では同じworkflowにより広いadapter/lifecycle検査を追加します。設定は本人の運用を永久blockしないPR approval0ですが、checkを捏造して通しません。

非秘密のローカルreadback evidenceはtask evidence directoryの`approved-settings-readback.json`。この過去の記録を将来のdeployment直前のlive保護readbackとして再利用しません。
