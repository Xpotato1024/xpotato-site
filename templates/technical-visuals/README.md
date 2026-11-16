# 技術図版の入力例

実行方法・許可する構文・媒体取込みとの境界は[技術ビジュアルの制作](../../docs/operations/technical-visuals.md)を参照する。

- `flow.mmd`: 実 Mermaid に渡す、縦配置の概念的なフロー図。図は承認・公開を実行しない。
- `line.json` / `scatter.json` / `bar.json`: 実 Vega-Lite/Vega に渡す**合成データ**。測定や性能比較ではない。
- 数式、Figure、元データ表、BarChart、ArticleEndnote を組み合わせた非公開入力は `tests/fixtures/technical-visuals/article.mdx`。

入力はコピーして非公開制作領域で編集する。実記事に任意 import・CSS・ランタイム描画を追加しない。生成 SVG・PNG・receipt・元データは Git に追加しない。
