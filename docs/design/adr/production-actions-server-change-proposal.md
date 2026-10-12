---
status: proposed
owner: operations
last_verified: 2026-10-06
---

# Server側変更案：サイトtoken再利用と検知・本人復旧

[Server Draft PR69](https://github.com/Xpotato1024/Xpotato-Server/pull/69)の日本語ADR-0031/canonical/operator契約を、本人の2026-10-06「検知と復旧があれば進めてよい」選択へ更新。**本人の2026-10-06限定認可でmerge済み**。実merge SHAは `ab9328c5a58082ac1ec268aa7d5901d838a6a474`。baseはServer 2caad17f9fa490b37727273b8c9a9a75178dfe1f。Siteはこの実merged SHAへ限定追従。credential/live activationをmergeだけで承認済みにせず、Draft headをauthorityへpinしません。

候補はEnvironment限定の個別Worker Editor保持（max90日/rotate60日/残存7日）、別IDの最小readonly monitor、provider/公開HTTPの継続観測、unknown/incidentで自動配布STOP+本人通知、本人Dashboard same-ID失効/必要公開停止/既知good artifact復旧/readback。**毎回一時operator token、自動token DELETE、常設admin/issuer、新serviceは要求しません。** 旧workstation JITの即revokeは維持。

監視は既存Actions5分schedule/failure email＋既存毎時ChatGPT本人taskの独立補助observer候補。Server Gitのdefinition/prompt/state/receipt schemaと外部API readbackで管理し、CPへ手変更を残さない。CPは初期必須から外し、将来Ansible/既存hook/SMTP成立後のみ移行。名目70分+遅延/ChatGPT停止/本人対応時間、短時間攻撃/条件付き応答/未sample path/R2 binding riskは[監視/復旧契約](../../operations/site-integrity-monitoring-and-recovery.md)参照。

失効は新規APIwriteを止めるだけで配布済み悪性code/settingsは消えない。正常artifactの独立取得/保存、exact selection/Production consumer、同一package再配布、settings/bindings=0/domain/routes/両endpoint/HTTP確認、本人再開が必要。expired artifactだけならRECOVERY BLOCKED。無許可rebuild/latest rollbackは代用しません。

Server明示採用/merge→Site merged exact pin→scope/通知/限定canary復旧live PASS→bootstrap/gate wiring→別production token/enable/operation認可の順。今回はcode/合成試験と設計資料のみ。credential保存、有効化、provider mutation、実復旧、deploy/merge、R2/DNS/media/C-lock/hold解除なし。
