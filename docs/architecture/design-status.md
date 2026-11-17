---
status: canonical
owner: architecture
last_verified: 2026-11-18
---
# 現在の設計・実装状態

## 採用済みコード

公開Astroサイト、記事制作・媒体保存pipeline、固定tool Release、共通デザイン、検索・分類とCMS基盤はmainにあります。CMSの責務分離・公開Git Draft PR方式はPR #217/#219で採用済みです。基準commitは`62936f765efcc5ab7db0508c06de392e64edef5a`。

[ADR-0080](../design/adr/0080-current-implementation-only.md)の整理方針は本人承認済みです。旧移行実装の再現を現在の開発の前提にしません。ContentId・公開URL・媒体・権利・44記事のholdを維持し、現在のRegistryと成果物を直接検証します。コード変更の取り込み状態とCIは対応PRで確認します。

## 実環境との区別

- 既存公開サイトの配信状況は[現行配信状態](../operations/current-deployment-status.md)だけを参照します。本整理は本番デプロイではありません。
- CMSのGitHub App owner installation、secret、Draft専用R2/Worker route、実iPhone、実課金・Free枠CPUの受入れは未完了です。Issue #220で追跡します。GCは接続・保持/復元の受入れまで無効です。
- 公開用A/B/CとDraftの権限を分離します。記事の正式export・媒体公開・本番配信は既存のowner/main/manual/Environmentとreadbackを維持します。
- Shadow DOMはIssue #218へ延期。人気記事・privateプレスサイトの実装も本変更に含みません。

## 権威と履歴

現在の構造は[Repository layout](repository-layout.md)、値はコードの単一SoT、操作はoperations文書、provider範囲は[Infrastructure handoff](infrastructure-handoff.md)が所有します。過去の凍結設計・Phase受入れ・旧準備状態は[固定Git版](../operations/source-history.md)に残ります。過去の「未実装」「Draft」記述を現在の状態として適用しません。

ADRは判断の理由、受入れ記録は対象commitでの観測を記録します。記録の存在だけで現在のprovider操作・公開許可を与えません。
