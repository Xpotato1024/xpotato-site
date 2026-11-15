---
status: proposed
owner: content
last_verified: 2026-11-15
---

# ADR-0078: 一貫制作の2入口と静的な技術ビジュアル

## 背景

記事やツールの部品・監査・保存手順は存在するが、作業担当が参照先を渡り歩き、本文完成をSite統合完了と混同しやすい。記事専用のCSS/asideや仮の図で穴を埋めず、人間の題材・意図から目的、読者、実素材、分類、SEO、preview、配備準備まで進めたい。数式・構成図・グラフもSiteの読みやすさと操作性へ調和させる必要がある。

## 採用する実装方針

通常の入口は既存 `japanese-technical-blog` と `create-browser-tool`。内部stageは独立した役割・固定request/responseを保持し、入口は工程の進行・復旧・引き渡しを担当する。共通構成、正確なCLI、編集判断、描画/保存実装の正本を分け、詳細規則を各Skillへ複製しない。

[共通構成](../../content/page-composition.md)でタイトル/lead/category/technology・purpose/date/hero/body/任意endnote/descriptionと各所有者を定義する。ツールは入力・結果を先に置き、操作を記事導入の下へ押し下げない。[一貫制作](../../operations/content-production.md)が目的整理から実素材・統合・QA・認可済み保存・配備準備までをつなぐ。

数式は既存KaTeXのbuild-time MathMLを維持する。MathJaxを併載せず、対応しない式は明示的に検出して表現/実装を検討する。共通parserと安全境界、コピー可能な原文、数式glyphの意味、局所overflowを保つ。

構成図はMermaidをローカル制作時に静的SVGへ変換する。手動配置が重要な図はdraw.ioの編集元を残して安全なSVG exportへ渡す。いずれもブラウザにviewer/iframe/描画libraryを送らない。回路図やCADの代用として使わず、専用ソフトの実出力と区別する。

小さなカテゴリー比較は既存BarChart。折れ線/散布図等はVega-Lite/Vegaの共通制作経路で静的SVGと基礎データを出す。入力は固定したローカルデータと有限な宣言に限定し、任意expression・remote URL・任意themeを開放しない。renderer既定の色/文字を記事ごとに調整せず、Site CSSから役割を取得する。

依存は制作時だけに置き、通常記事のclient runtimeやCSPを広げない。Mermaid/Vegaを同じ巨大な汎用図APIへ統合せず、入力検証と制作入口、theme、出力検査、receiptを共用する。元source/データと出力hashを残すが、新しい本人承認receiptや公開状態機械は作らない。

## 検討した代案

- 一つの巨大なSkillへ全契約をコピー: 更新差分が分散しない利点よりも、常時context肥大・役割混同・規則の古さが問題になるため採らない。
- client MathJax/Mermaid/Chart.jsの標準導入: 必要時の高度な対話には利点があるが、通常記事では初回描画、通信、CSP、JavaScriptなし表示の負担を増やすため採らない。
- グラフをすべて手書きSVG: 小さなBarChartでは適するが、尺度/軸/凡例等を毎回実装する誤りと保守負担がある。データ表現は専用rendererを用いる。
- すべて画像生成: 正確な式・回路・測定点・CAD/シミュレーションの再現元にならないため技術的証拠には使わない。

## 受入れ

正例/負例の入力検証、実libraryによる描画、unsafe/外部参照・出力上書き・上限超過の拒否、同条件の出力再生成、Site実レイアウトでの320/390/1440px・文字拡大・必要なprint/focusを検査する。図の存在や横はみ出しゼロだけで可読性を自己認定しない。グラフには値/表/データ、構成図には関係の説明、数式には原文と記号説明を残す。

手順の構造test、実renderer試験、ページQA、実R2保存、独立review、本人の編集判断は別の証拠として報告する。新規記事、文章中心、tool、限定更新の各経路で適用/不要を区別する。

## 権限・互換性

この変更は実装候補。merge/production配信、媒体公開、人間承認、設計採用、R2設定変更を自己発行しない。既存ContentId/URL、公開本文、taxonomy値、media receipts、凍結履歴は変更しない。新しい形式の公開対応を役割名だけで推定せず、ZIP/CAD等は実schemaと保存経路で確認する。

過去のJobの固定Skill/referenceは書き換えず、将来の作業へ更新を適用する。再検証は変更の影響範囲で行い、無関係な全件監査を追加しない。実装・試験結果は当該PRへ記録する。

## 一次資料

- KaTeX API/options: https://katex.org/docs/api / https://katex.org/docs/options.html
- Mermaid accessibility/theming: https://mermaid.js.org/config/accessibility / https://mermaid.js.org/config/theming
- Vega static rendering: https://vega.github.io/vega/usage/ / https://vega.github.io/vega/docs/api/view/
- draw.io SVG export: https://www.drawio.com/docs/manual/export/export-to-svg/

確認日2026-11-15。正確な採用版はpackage-lockと描画receiptに固定し、文書の最新版表記から自動更新しない。
