# 作業コードの所有者

| 場所 | 現在の役割 |
|---|---|
| authoring/ | 記事・固定ページ・ツールの制作、CMS契約出力、固定commitのAstroレビュー |
| build/ | site/editorの各1回のbuild、検索・公開manifest/CSP・PWA資産の生成 |
| media/ | 共通profileによる画像/GIF変換、承認済みA/B/C媒体登録 |
| qa/ | 現行機能のブラウザ・契約・現在の公開成果物の検証 |
| ci/ | 変更範囲、並列job、同一runの成果物適格性 |
| deployment/ | owner/main/manual/Environment、artifact照合、配信・readback・監視 |
| design/ | 現行デザイン資産の参照・所有検査 |
| engagement/ | 採用済みの場合の問い合わせ受付 |

実行入口はroot package.json。制作用ロジックをテストに埋め込まず、テストは同じ入口と契約を利用します。旧migration:*、Phase番号の入口、retired operatorはありません。

公開検証は`site:output:check`、現行ツールの検証は`tools:readiness`。旧サイトを再buildして判定する方式ではなく、現在のcatalogとdistからURL、検索、RSS、sitemap、hold、runtime、配信ヘッダーを確認します。

[通常の制作手順](../docs/operations/content-workflows.md)・[CMS](../docs/operations/editor-workflow.md)・[配信](../docs/operations/deployment-boundary.md)を参照。旧版は[Git履歴](../docs/operations/source-history.md)から調査します。
