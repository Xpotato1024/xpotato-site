# 固定来歴と配信境界のコード

日常の作成・更新・build補助・QAは[`tools/`](../tools/README.md)。このdirectoryを新しい汎用作業コードの置場にしない。

- `release/`: CI成果物の取得・staging・配信・有限の公開照合・復旧に関する現役実装。workflowとWindows consumerが参照する。`tools/publication`のR2記事保存とは別操作であり、配信入口を増やさない。
- `ci-scope.mjs`、`conditional-scope.mjs`とそのテスト・`release-graph.test.mjs`: 実行範囲と既存CI graphの検証。workflowから呼ばれる。
- `article-concrete-preview.ts`、`article-concrete-render.mjs`、`article-concrete-browser.mjs`、`article-concrete-check.mjs`、`article-concrete-export.mjs`、`article-preview-state.mjs`、`article-existing-reference.ts`: 既成稿の描画・正式取込みの再現入口。`packages/article-pipeline/src/existing-render-context.ts`の固定path集合に入り、source fingerprintの対象になる。現在の記事本文を編集する入口ではない。

最後の7ファイルは単なる未使用scriptではない。移動するなら既成稿取込みの描画contextの変更・失効範囲を先に扱う。過去のhash固定証跡を新pathへ書き換えず、この限定互換境界を維持する。将来の原稿に同じpath固定を追加しない。

旧WordPress importerと2本のcurl公開確認は廃止。前者は旧rootを生成する移行前専用writerで、現行の固定tag migrationとは別経路だった。後者はHTTP statusだけを見てRegistry・権利・保護・配信manifestを検査せず、現行配信の確認処理と重複していた。必要な旧版の調査は`792580d7088c0a1e0aebe3857185f3a87968a502:scripts/<旧filename>`をGitから読む。現行操作には復活させない。
