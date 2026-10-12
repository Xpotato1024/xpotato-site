---
status: proposed
owner: operations
---

# ADR-0047: 毎時Workers観測と外部未着通知の無料運用候補

## 問題

旧Actions有限試運転は自然scheduleのcoverageを確認できず、稼働と証拠収集の仕組みが運用目的に対して複雑になった。長時間気付けない失敗を避ける必要があるが、非営利Siteの監視に追加の有料サービスを採らない。

## 候補

Workers Freeの毎時Cronで公開応答と必要な構成整合性を点検し、Healthchecks Hobbyistの一つのcheckへ正常/failureを送る。1h Period + 2h Graceの未着は観測停止として扱う。API不可はUNKNOWNであり公開PASSで消さない。baselineは本人承認の実deploy済み状態へ固定する。

初期はKV/D1、複数check、公開status、GitHub history collector、restart receipt、新server、AI定期runを足さない。CPU10msと共有枠/課金増0は未検証で、成立しなければ導入保留。通知と古い結果の順序にも残余リスクがある。

## 制約と判断先

正確なscope、静的取得数、無料成立条件、状態表、受入試験、本人setup/承認手順は[運用候補](../../operations/site-monitor-hourly-free-proposal.md)に定義する。Proposedであり実装/稼働/課金/受領の合格ではない。既存gate/STOP・過去incident・公開禁止を保持する。ADR-0044〜0046の履歴を削除/成功化せず、本候補の採用まで既存の正規設計を自動置換しない。
