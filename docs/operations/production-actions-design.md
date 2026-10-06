---
status: proposed
owner: operations
last_verified: 2026-10-06
---

# 正式Actions方式Bのreview用実装（実配布は停止）

本人は2026-10-06に「検知と復旧」を条件に、期限付きsite token再利用と異常時本人Dashboard対応の簡素化を承認しました。**配布ごとの一時operator token、自動失効controller、常設広域adminは必須にしません。** [ADR0043](../design/adr/0043-production-actions-authentication-boundary.md)、[監視・復旧契約](site-integrity-monitoring-and-recovery.md)、[Server Draft PR69](https://github.com/Xpotato1024/Xpotato-Server/pull/69)がreview対象。Server採用/merged exact pin・実操作許可は未成立です。

現行authorityは[Infrastructure Handoff](../architecture/infrastructure-handoff.md)、[Deployment Boundary](deployment-boundary.md)、[Build Artifact Pipeline](build-artifact-pipeline.md)。production workflowは3jobともliteral false、secret参照・実deployなし。main保護/空Environmentと本人の非配布承認試験だけ[適用・PASS済み](production-protection-acceptance-20261006.md)。監視もliteral false、scheduleはコメント、baselineはUNINITIALIZEDです。

## credential-free検証

```text
node --test scripts/release/environment-approval.test.mjs scripts/release/deployment-policy.test.mjs scripts/release/deployment-persistent-policy.test.mjs scripts/release/deployment-adapters.test.mjs scripts/release/site-integrity-monitor.test.mjs
```

metadata plannerはGitHub認証済みGETのみ。outputはsystem temp/RUNNER_TEMP子でreparse escapeを拒否。

```text
node scripts/release/deployment-plan.mjs RUN_ID ATTEMPT ARTIFACT_ID SOURCE_SHA sha256:DIGEST ABSOLUTE_TASK_TEMP_OUTPUT
```

exact completed-successful main run/attempt/artifact digest/期限を確認してもBLOCKED_CREDENTIAL_AND_LIVE_ACCEPTANCE。archive/staging/本人承認/Cloudflare能力を証明しません。既存Production consumer、再buildなし、Wrangler4.136.1/config固定を維持。

## 正式Bのgate

| evidence | 必須内容 |
| --- | --- |
| release/protection | exact main producer/source/attempt/artifact API digest、Production archive/staging、strict main result+offline-policy、owner-only main Environment承認/bypass false |
| deploy token | 個別Worker Editor allow1/追加0、max90日/rotate60日/残存7日、same-ID。初期/更新の本人raw policy照合、使用時active/ID/期限。monitorへtoken管理権限を足さない |
| monitoring | approved good baseline、provider全取得+公開HTTP、fresh complete monitor履歴。failure/cancel/unknown/gap/欠落はSTOP、later successでincidentを消さない |
| owner response | Dashboard exact-ID失効/必要公開停止能力、実通知受信、正常artifact独立取得可能性、対応時間が本人依存である受理 |
| provider/write | fresh preimage、expected deployment/version/100%、bindings/routes=0、既存domain、両endpoint false+実URL404、single pinned deploy、再build/config変更なし |
| postimage | expected versionとartifact HTTP/settings一致。失敗はSTOPPED_OWNER_RECOVERY_REQUIRED、revoke/contain/recovery成功を捏造しない |
| rotation/recovery | 本人の新狭scope発行/Environment更新/旧ID失効確認。incident時は正常artifact再配布+settings/bindings/domain/endpoints/HTTP確認+owner再開。revocationだけでは悪性codeは消えない |

normalized JSONのtrueはactual API/人間承認の代わりではありません。B assessPersistentOperationはmonitor historyとowner readinessを要求。旧JIT assessOperationEvidenceの直前発行/即失効は不変。旧強権operator adapter/supervisorはoptional libraryで簡素化Bには結線しません。

## 未接続・未受入れ

- actual read scope/全zone可視性、Dashboard role、token初期policy確認・保管・更新。
- 5分schedule、本人GitHub email、既存CP freshness hookとSMTP。CP/Gatus runtimeは未確認。schedule遅延/drop、CP同時停止/本人不在の限界は[契約](site-integrity-monitoring-and-recovery.md)参照。
- production開始/write直前のmonitor gate、protected runner/bootstrap、pinned Wrangler receipt、approved baseline promotion。libraryだけでは本番writeを停止できない。
- 保存済み正常artifactによるcanary検知→本人失効→正常復旧→readback、通知受信のlive試験。
- Server採用/merged pinと最後のproduction enable/operation authorization。

必要操作は[一括認可表](site-integrity-monitoring-and-recovery.md#次の一括承認すべて未実行)。有効化・new credential・provider mutation・実復旧・deploy・mergeは今回行いません。R2/media/C-lock/DNS/redirect/holdと旧JIT撤去gateは維持。
