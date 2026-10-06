---
status: code-and-mock-verified-live-pending
owner: operations
last_verified: 2026-10-06
---

# 方式B adapter：コード試験とlive接続の境界

全provider testは合成mock。live credential接続・production deployは未実行。本人選択は「通常site token再利用、継続read監視、異常時本人Dashboard失効と正常artifact復旧」。毎回一時operator tokenと自動DELETEを必須にする旧提案は外しました。

| module | 実装と境界 |
| --- | --- |
| deployment-http.mjs | 明示fetch/credential、固定origin/path/method、redirect拒否、body1MiB、lookup含む10秒timeout、static secret-safe error、mutation再試行なし |
| deployment-cloudflare.mjs | 旧site-read/audit-read/token-revoke/endpoint-contain分離adapter。raw policy/selector/pagination/providerを照合。audit/revokeの一時operator authorityは新B通常経路に使用しない |
| deployment-data-plane.mjs | verified artifact hash/marker、実UUID先頭8文字Version URL、authなしbyte確認。403/redirect unknown |
| deployment-github.mjs | main/Environment/branch policy/Secret**名**とowner approval/run GET。bypass field欠落は別認可fresh UI callback、403 STOP。production attempt1、新manual dispatchのみ |
| site-integrity-monitor.mjs | readonly GETのみ、approved deployment/version/settings/script-settings/resources/bindings/endpoints/domains/全zones/routesと公開HTTPsamples。unknown/drift→INCIDENT_OWNER_ACTION_REQUIRED、baseline自動更新なし |
| site-monitor-history.mjs | Actions(read)で全history、incident/gap latch。fresh successだけでは解除せず新owner checkpointが必要 |
| deployment-persistent-policy.mjs | B token/protection/handoff、fresh monitor履歴+owner readiness、failureはSTOPして本人復旧待ち。自動revoke boolを要求しない |
| deployment-supervisor.mjs | **optional強権operator library**。事前独立scope/認可下の自動revoke+containment。簡素化Bの必須gateから除外、常設host/credentialなし |

import/constructionで通信/mutationなし。monitor CLIのみ明示opt-inでhost envの専用readonly Secretとfetchを使う入口を用意したが、workflow false/schedule無し、UNINITIALIZED baselineは通信前に拒否。production bootstrap/gateとの結線、canary別target入口、運用配置は未完。

## 合成試験

固定version/HTTP一致、異version、bindings/設定/script-settings/endpoint/domain/routes変化、HTTP改ざん/redirect、403、partial/duplicate inventory、multi-read drift、秘密error非反映を検証。historyのfailure/cancel/skipped/pending/10分gap/欠落/staleはSTOP、later successで解除なし。revokeのみ、別artifact、settings/bindings/endpoints/HTTP未確認、本人再開なしの復旧evidenceを拒否。

実通知・本人失効・正常artifact配布のlive成功ではありません。[監視/復旧契約と一括承認表](site-integrity-monitoring-and-recovery.md)にscope/通知先/頻度/費用/遅延/停止時を記載。monitorにAccount API Tokens Read/Writeを付けず、policy変更や短時間攻撃の限界を明記。

## optional旧supervisorの取消契約

既存timeout修正を維持。callback(identity, operation)のAbortSignal/deadlineをadapterへ渡し、遅延認可/lookup/write前readback後に取消確認。timeout後新DELETE/POSTゼロを試験。既送信write取消は保証しない。旧libraryを新B自動失効保証に使いません。

## 公式根拠とlive依存

[script-settings GET](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/get/)と[domain GET](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/list/)はWorkers Scripts Read等がaccepted permission。[公式SDK](https://github.com/cloudflare/cloudflare-typescript/blob/main/src/resources/workers/scripts/settings.ts)もscript-settings pathを示す。settingsとscript-settingsは別々に読む。Individual Worker Viewerで全required GETが通るかは未実証、失敗で広域権限にfallbackしません。

旧[DELETE](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/delete/)のAccount API Tokens Write/[list-self制限](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/list/)はoptional強権adapter固有。新Bは本人Dashboard失効で、API全inventory/detail404のため常設adminを追加しない。本人exact-ID操作/一覧不在の受入れ証拠が必要。

blockerはServer adoption/pin、actual readonly scope/通知/CP稼働、正常artifact独立保持、限定live検知復旧、protected wiring/approval、最後のproduction認可。[非配布承認run PASS](production-protection-acceptance-20261006.md)はこれらの代用ではありません。
