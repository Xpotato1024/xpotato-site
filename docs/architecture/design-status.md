---
status: canonical
owner: architecture
last_verified: 2026-11-18
---
# 現在の設計・実装状態

## 採用済みコード

公開Astroサイト、記事制作・媒体保存pipeline、固定tool Release、共通デザイン、検索・分類とCMS基盤はmainにあります。CMSの責務分離・公開Git Draft PR方式はPR #217/#219で採用済みです。その採用記録の基準commitは`62936f765efcc5ab7db0508c06de392e64edef5a`であり、以下の追加機能の採用や現行配信を表す値ではありません。

[ADR-0080](../design/adr/0080-current-implementation-only.md)の整理方針は本人承認済みです。旧移行実装の再現を現在の開発の前提にしません。ContentId・公開URL・媒体・権利・44記事のholdを維持し、現在のRegistryと成果物を直接検証します。コード変更の取り込み状態とCIは対応PRで確認します。

[ADR-0082](../design/adr/0082-native-cms-connection.md)の初回接続方式は、GitHub App Manifestと固定Wranglerを用いる。CMS専用Server counterpartは[Infrastructure Handoff](infrastructure-handoff.md)に固定し、本人認証と実保存の確認は下記の実環境受入れへ残す。

## 機能ブランチの追加実装

2026-11-18の`feat/cms-workbench-series-20261118`は、`3e0d12a890aba8370e880ffc6b586490bc9a4af3`を基準に、CMSの編集画面と公開サイトの連載導線を追加しています。この文書の更新をmerge・deployの完了とは扱いません。

- **編集画面:** 記事情報と本文だけのMDXを分離し、原文を保持するリッチ編集、入れ子の部品、本文内の移動ハンドル、MDXの色分けと折り返し、コード言語・数式入力を実装しています。記事・メモ・教育記事・固定ページ・ツール・プロダクトの入口、分類・目的タグ等の検索と追加も含みます。
- **添削と履歴:** 本文の位置に紐付く指摘、修正案の対象照合、私有review revisionの比較更新、端末の履歴・元に戻す／やり直すを実装しています。指摘から外部AIやArticle Jobを自動起動する経路は未接続です。JSONと同じGit作業ブランチでの受け渡しが現在の範囲です。
- **プレビュー:** 即時表示は実サイトのCSS・フォントを共有し、1440／834／390pxのviewportと倍率を選べます。安全なAST描画であり、対象commitの正規Astro出力による正式レビューと区別します。
- **連載:** [ADR-0083](../design/adr/0083-managed-series-reading-order.md)に従い、ContentIdの順序付きregistryから前後リンク・全体目次・教育一覧を静的に生成します。未公開の所属・件数を公開せず、初期registryは空にしています。

契約は[CMS編集画面](../contracts/cms-workbench-contract.md)と[連載・学習コース](../contracts/series-contract.md)、リッチ編集・必要時の読込・CMS専用runtime予算の判断は[ADR-0084](../design/adr/0084-source-preserving-rich-cms-editor.md)が所有します。ローカル検証、対象buildでのブラウザー試験、GitHub CI、実サービス接続は[CMS実装状態](cms-implementation-status.md)で分けます。

## 実環境との区別

- 既存公開サイトの配信状況は[現行配信状態](../operations/current-deployment-status.md)だけを参照します。本整理は本番デプロイではありません。
- CMSのGitHub App owner installation、secret、Draft専用R2/Worker route、実iPhone、実課金・Free枠CPUの受入れは未完了です。Issue #220で追跡します。GCは接続・保持/復元の受入れまで無効です。
- 公開用A/B/CとDraftの権限を分離します。記事の正式export・媒体公開・本番配信は既存のowner/main/manual/Environmentとreadbackを維持します。
- 公開サイトのツール表示をShadow DOMで隔離する変更はIssue #218へ延期しています。CMSのSourceEditor内にあるopen ShadowRootはCodeMirrorのテーマをCSPに沿って適用するための局所的な実装であり、Issue #218の対応を意味しません。人気記事・privateプレスサイトの実装も本変更に含みません。

## 権威と履歴

現在の構造は[Repository layout](repository-layout.md)、値はコードの単一SoT、操作はoperations文書、provider範囲は[Infrastructure handoff](infrastructure-handoff.md)が所有します。過去の凍結設計・Phase受入れ・旧準備状態は[固定Git版](../operations/source-history.md)に残ります。過去の「未実装」「Draft」記述を現在の状態として適用しません。

ADRは判断の理由、受入れ記録は対象commitでの観測を記録します。記録の存在だけで現在のprovider操作・公開許可を与えません。
