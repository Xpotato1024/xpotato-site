---
status: proposed
owner: content
last_verified: 2026-11-15
---

# 記事・ツールの共通構成

共通化するのは項目の意味、表示部品、責任範囲。本文の章立て・図数・タグ数を全記事で固定することではない。制作の順序は[一貫制作手順](../operations/content-production.md)。正確な型は `packages/content-contracts/src/content.ts`、表示は現行layout/component、値はCSSの共通tokenが正本。

## 記事

| 要素 | 内容の責任 | 表示・導出の責任 |
|---|---|---|
| タイトル | 主題・読者の問いを過不足なく表す | BlogDetail/ContentLayoutのH1と共通一覧。検索titleは対応schemaのoverrideだけ |
| リード文 | 対象・出来事/課題・読む理由を自然に導く本文冒頭 | 既存のlead抽出。descriptionや導入と同じ説明を繰り返さない |
| 主分類 | 記事全体の主題に合うactive categoryを一つ | 共通taxonomy表示/一覧 |
| 技術タグ | 本文で扱う領域・手法・製品等。既存IDとaliasesを先に確認 | 同じtags配列をRegistryのtechnology kindで分類 |
| 目的タグ | 解説・比較・レビュー・設計等の実際の読者価値 | 同じtags配列をpurpose kindで分類。空欄をダミーで埋めない |
| 公開日・更新日 | 元pubDateを保持。公開/実質更新の意味を守る | 正規exportと共通日付表示。初回updatedDateなし |
| ヒーロー | 記事の識別、元画像・権利・alt、安全なcrop | Media Registry/MediaHero。OGは共通生成 |
| メインコンテンツ | 問いに答える文章、図、GIF、式、表、グラフ、コード、配布物 | Markdown/active semantic modulesと共通描画 |
| 補足aside | 必要時だけ短い来歴・方法・限界。結論や重要条件の代用にしない | activeなArticleEndnote。記事固有HTML/CSSを使わない |
| description | 一覧・検索結果向けの一つの要約。リードとは別の役割 | 一覧/meta/OG/Twitter/JSON-LDへ同じ正本を投影 |

関連テーマtopicは必要な場合だけ追加する。主分類とtechnology/purposeは階層や固定ペアにしない。結論は読者の判断や次の行動を示し、独立見出しが不要なら自然な末段で閉じる。

## ツール

標準の読順は **名称・短い用途 → 入力と主要操作 → 結果 → 使い方・実例 → 制約と補足 → 採用版・利用条件・対応ソース**。heroは任意で、操作を長い記事導入の下へ追いやらない。

入力形式・単位・例・上限、正常/処理中/空/エラー、必要な取消・再実行・copy/downloadを設計する。不要な状態や権限を雛形の都合で増やさない。計算はcore、GUIはUI、host接続はadapterで分け、固定版を正式installerから取り込む。

名称・description・分類・tags・日付・SEO・Site shellは共通系を利用する。tool固有のUIや演算は独立sourceが所有し、Site側にコピーして直さない。公開API/tokenでthemeを受け、vendor内部selectorの上書きをしない。詳細は[ツール契約](../contracts/browser-tool-authoring.md)。

## 使用できる本文要素

| 伝えたいこと | 標準手段 | 注意 |
|---|---|---|
| 文章・箇条書き・順序・数表 | Markdown、必要時Steps/DiagnosticList/Comparison | 手順と選択肢を混同しない |
| 静止画・比較図 | semantic mediaとFigure/Gallery | alt・必要な出典、比較条件、文字の実表示幅 |
| 動き・時間差 | 実フレームから正規animated mediaとposter | 停止/reduced-motion、同一物体・時刻・実測/模式の区別 |
| 数式 | 既存KaTeXのbuild-time MathML | コピー可能なTeX、記号の定義、局所scroll。MathJaxとの二重導入なし |
| フロー・構成 | 共通Mermaid制作経路から静的SVG | 関係の正確さ、読み順、代替説明。client runtime不要 |
| 手動レイアウトが必要な構成図 | draw.ioの編集元と安全なSVG export | viewer/iframe/外部fontを持ち込まない |
| 小さいカテゴリー比較 | 既存BarChart | 0始点・値と単位を表示。比較条件は本文に残す |
| 折れ線・散布図・近似曲線 | CMS・MDXのLineChart、または共通Vega-Lite図版制作経路から静的SVG | 元データ、単位、軸、凡例、色以外の区別、表/データ代替。近似は方法・式・対象範囲も保持 |
| 回路・機構・3D断面 | 回路設計ソフト・CAD・simulationの実出力 | 汎用構成図・生成イラストを実モデル/実結果の代わりにしない |
| CAD/CSV/ZIP等 | 内容確認済み配布物と管理されたdownload経路 | MIME/size/hash/license、私有情報除去、実取得。画像変換と分ける |
| 補足・注意 | 必要箇所にCallout/Details、末尾だけArticleEndnote | 重要条件・危険を末尾や閉じた領域に隠さない |

詳細は[技術ビジュアル](../operations/technical-visuals.md)、[工学素材](../operations/engineering-visuals.md)、[動く図](../operations/animated-article-media.md)。利用可能性は現行schema/Registryで照合する。汎用Vegaの任意code、Mermaidの任意設定や外部linkを記事入力APIとして開放しない。

## 共通デザインの境界

フォント、見出し階層、本文幅、行間、図題、表、日付・分類、aside、focusは[部品の役割](../design/component-roles.md)を再利用する。色と寸法の値を記事、Skill、別JSONへ複製しない。数学用glyphは数式rendererに任せ、本文fontへ強制置換しない。

新記事にarticle ID/URL指定のCSS、専用aside、style属性、任意runtime importを追加しない。図の色・文字役割も共通themeから得る。図自体に必要な幾何・線・凡例は保持し、ページ側の任意装飾と区別する。

既存部品で不足する場合は、目的→既存との差→共通API/所有者→実装→契約/実表示testの順で拡張する。あらゆるUIを巨大な汎用componentへ統合せず、単独toolの固有操作は適切なnamespace内に残す。新しい共通表現は記事専用の例外でなく、次の記事でも使える形にする。

## UXの受入れ

PCと320/390px、文字拡大、キーボード、静止/動作、必要な印刷表示を確認する。本文・図中文字・式・数表の主従を同じ画面で見る。モバイルで読めない図を一律縮小せず、分割/縦並び/局所scrollを選ぶ。操作不能なhover依存、色だけの区別、説明のない画像リンクを避ける。

公開記事を変更しない私有fixtureで部品を組み合わせ、共通の正式描画を通す。fixtureの成功は実記事の内容承認、公開、実機検証ではない。
