---
status: accepted
owner: architecture
last_verified: 2026-11-18
---
# ADR-0081: 読めるソース、責務ごとの分離、理由を残すコメント

## 背景

CMSのAppとCSS、APIや運用コードが長い一行へ圧縮され、CI成功だけでは保守性を確保できていなかった。ユーザーがHow/What/Why/Why notの役割分担と、整形・責務分離・コメント方針の導入を承認した。

## 判断

固定PrettierとAstro pluginを使い、既存source preflightで検査する。生成物やimmutableな公開データは再整形しない。整形だけのcommitと責務変更を分離する。

CMSは端末内下書きの寿命、Gitの固定snapshotと競合、本文編集、画面構成を分ける。APIは認証を入口で明示し、Git操作とDraft媒体操作へ分離する。汎用routerや新しい状態管理ライブラリは追加しない。

コード=How、テスト=What、コミット=Why、コメント=Why notを主な責務とする。単位・不変条件・公開APIの前提など必要な説明を禁止しない。継続する横断判断は既存ADR/contractが所有する。

読みやすい公開JSのソースをそのまま配信して転送量を増やさない。既存ビルドで配信用byteだけを空白圧縮し、既存の容量上限と実成果物の安全性検証は維持する。

具体的な規則と運用の正本は[code-style](../../operations/code-style.md)。このADRに設定値を複製しない。

## 維持するもの

本文とContentId、公開URL、分類/検索/SEO、媒体の権利・公開保留、MDX正本、オフライン保存、Git競合時の原稿保全、認証・CSRF・容量/削除境界を変えない。R2/GitHub Appの有効化、本番デプロイ、画像の削除は行わない。
