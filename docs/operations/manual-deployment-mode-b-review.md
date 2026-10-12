---
status: proposed
owner: operations
last_verified: 2026-10-12
---

# 方式Bの手動配信：metadata診断と初回設定のDraft

正常配信では既存の期限付きWorker限定tokenを再利用し、配布ごとの発行・失効は必須にしない。現 `deployment-persistent-policy.mjs` の `perOperationRevoke=false` に沿う。credential設定・provider操作・監視変更・workflow有効化はこのDraftに含めない。

## metadata診断

`manual-deployment-readiness.mjs` はsecret名、Environment保護、手動workflowと配信接続の状態だけを入力とする。secret値・provider応答・credentialを読まない。存在確認だけで有効性を認定せず、全metadataが揃っても `credentialValidity=UNVERIFIED`、`deployAllowed=false`、`deployExecuted=false` を維持する。unknown fieldは拒否する。

本人が選択した工程は初回Site配信確認→新監視Worker→旧Actions撤去。初回分類 `INITIAL_SITE_BEFORE_NEW_MONITOR` は次期監視完成を前提にせず、初回限定の手動admissionを実provider preflight・公開HTTP・本人対応の証拠でreviewする必要を示す。PROPOSEDな旧gateをACTIVEと偽装しない。

## 初回設定と配信接続のreview対象

- 使用可能な既存Worker限定tokenを優先する。必要な場合だけ本人が既存Environmentへ直接入力し、AI・chat・local fileへ秘密値を渡さない。既存保護を緩めない。
- 設定名と保護・scope/lifetime方針は [方式Bの設定提案](production-settings-approval.md) に従う。配信用secretと監視read tokenを区別し、監視tokenへwrite/admin権限を追加しない。
- mainの手動dispatchと本人Environment承認を通し、指定main push runのProduction artifact・source/config/stagingを正式consumerで照合する。再buildやPR candidateを代用しない。
- reviewed wiringのgate通過後だけpinned Wranglerの単発deployとpost-readbackを行う。正常時は同tokenを維持し、失敗/unknownでは本人対応へ戻す。このDraftはその実deploy接続を実装しない。
- 旧audit-read adapterの直前発行要求を方式Bの必須条件にしない。固定readonly GETと本人の初回/更新policy照合へ責務を分ける接続をreviewする。

最新mainと選択artifactのsourceは別々に照合し、過去artifactを最新mainとして偽装しない。公開内容・workflow・lockに影響しない文書差分は説明可能な証拠として再利用する。公開保留を維持し、live結果の成功を生成しない。

## 検証と範囲

metadata診断7件、UTF-8/no-BOM/LF、diffとpatch照合を対象にする。追加は文書・pure diagnostic・テストの3ファイル。既存workflow変更0、production jobは無効のまま、push/PR駆動deployなし。具体的な運用metadataと配信identityは公開文書へ複製せず、本人用のローカル証拠で保全する。
