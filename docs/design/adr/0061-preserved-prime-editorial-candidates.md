---
status: proposed
owner: architecture
date: 2026-10-31
---

# ADR-0061: 移管済みPrimeの本文編集候補を原文と分けて固定する

## 問題

manual-prime-v1移管記録のcontentSha256は原文全体を固定し、installerは任意の編集を拒否する。この保全は必要だが、本人が依頼した紹介文や操作案内の編集をレビューする正規の候補経路も必要となった。移管時のhashを新しい本文へ上書きすると履歴を失う。

## 提案と実装候補

移管configのfromHead・contentSha256・placementは元のsnapshotのまま保持する。別のsource-ownedなclosed setへ、今回の本文全体のexact SHA-256・一致するdescription・review文書の参照を追加する。移管時のbaseline hash／descriptionとの一致、本文全体のhash一致を要求する。その他のplacement・ContentId・toolId・公開admission・pin・lock・生成物検査は従来どおり行う。

本文の更新日・説明・既存補足を含め、1 byteでも未知の差分なら従来のeditorial review requiredで停止する。新規hashを自動承認・計算して登録するCLIや、自由なmetadata/body overrideは追加しない。将来の編集は新しいsource差分としてレビューする。初回snapshotと既知の過去候補を残すことで、元の版の検査と復旧も維持する。

このsource候補の列挙はAIによるHumanApprovalRecord、Article Job receipt、公開承認を作るものではない。通常のPRレビュー・採用判断・merge・Production artifact・deploy認可が引き続き必要。本提案をacceptedへ自動昇格しない。

## 今回の境界

対象は高速性の紹介とコピー／共有の手動導線を加えたTool本文のみ。toolkitのvendor・数学的意味・runtime・権限・公開対象・route・ContentId・分類は変えない。移管placementのdescriptionは歴史snapshotで、現在表示するdescriptionはexact本文候補から解決する。未知のbaseline descriptionや本文は拒否する。

## 検証

原文と今回のexact候補、任意byte差分、ContentId／公開状態／日付／分類／tag／module差替え、baseline hash／description改変を検査する。既存移管・更新・rollback試験も維持する。
