---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - MDX content module API policy
---

# MDX Content Module Contract

## Principle

通常Markdownで足りない意味構造だけをapproved moduleにする。article authoringはR2 URL、React source path、Tailwind utilityを直接所有しない。

## Plain image

```md
![メモリスロット](media:nas-memory-slot)
```

`media:`はcurrent contentのMedia Asset Registryに対するlogical reference。build transformerがwidth / height / responsive delivery URLへ解決する。

## Figure

```ts
interface FigureProps {
  asset: string;
  alt: string;
  title?: string;
  caption?: string;
  note?: string;
  credit?: string;
  sourceUrl?: string;
  width?: "content" | "wide" | "full" | "compact";
}
```

`asset`はlogical media ID。storage URLではない。

図題・説明・補足・出典の役割と描画順は[記事の図版標準](../content/figure-standard.md)に従う（このブランチの後方互換追加候補、未merge・未配信）。`title`と`note`はplain textの任意属性で、前後空白除去後それぞれ1〜120/1〜600文字。空白だけは拒否する。既存の`caption`は説明文のまま維持し、credit/sourceだけでも表示する。全旧call siteはtitle/noteなしで継続できる。

## Gallery

```ts
interface GalleryProps {
  label?: string;
  width?: "content" | "wide";
  children: MDXContent;
}
```

childは原則`Figure`。column数はdesign systemが決める。

## Callout

```ts
interface CalloutProps {
  kind: "note" | "tip" | "warning" | "important";
  title?: string;
  children: MDXContent;
}
```

## ArticleEndnote（Draft / レビュー候補）

記事末尾の短い制作方法・図の出自・検証範囲を、本文と区別する任意の共通module。本番採用・既存記事への一括適用を意味しない。

```ts
interface ArticleEndnoteProps {
  title?: string; // plain text、trim後1〜100文字。省略時「記事について」
  children: MDXContent; // 空でない短い段落。強調・リンク・inline code等の安全なinline Markdownのみ
}
```

```mdx
<ArticleEndnote title="図と検証について">

図は仕組みを説明する模式図です。寸法や荷重を測定した結果ではありません。

</ArticleEndnote>
```

トップレベルのblockとして結論の後、共有・footerの前へ置く。Siteがラベル付き`aside`と通常の日本語ラベルを描画し、控えめな上罫線・小さい文字・既存tokenで本文と区別する。見出しや目次項目、badge、alert、操作部品は追加しない。
タイトルは文字列リテラルのみで、空白だけ・改行/制御文字は拒否する。未指定の属性をDOMへ渡さない。本文の見出し・リスト・コードblock・図・別module・生HTML・JSX式・任意importは許可しない。
長いコード、法的告知、主要な安全警告、判断に必要な主張・条件は本文の関連箇所に残す。末尾へ移して読者の判断から切り離さない。詳しい編集判断は[記事末尾の補足](../content/editorial-policy.md#記事末尾の補足draft--レビュー候補)を参照する。

## Steps / Step

```ts
interface StepsProps { children: MDXContent }
interface StepProps {
  title: string;
  result?: string;
  children: MDXContent;
}
```

plain ordered listで足りる場合はMarkdownを優先する。

## DiagnosticList / DiagnosticItem

症状、最初に確認する候補、理由を複数繰り返す記事で使用する。表が適する並列評価や、順序を持つ手順は従来どおりMarkdown表またはStepsを優先。

~~~ts
interface DiagnosticListProps { children: MDXContent }
interface DiagnosticItemProps {
  symptom: string;
  check: string; // 観察可能な確認内容
  action?: string; // 見直す候補
  reason?: string; // 理由があるときだけ表示
  children?: MDXContent; // ラベルを強制しない補足
}
~~~

~~~mdx
<DiagnosticList>
  <DiagnosticItem symptom="曲げると折れる" check="割れた場所と積層方向を確認します。" action="外周と造形方向を検討します。" />
</DiagnosticList>
~~~

DiagnosticItemはDiagnosticList直下、DiagnosticListには1件以上を配置する。
属性は文字列リテラルのみで、JSX props式/生HTML/記事ごとのスタイル指定は禁止。
Site側はDefinition Listで症状、確認内容、任意の見直す候補と理由を一貫表示する。未提供の理由ラベルは出さない。アイコンはaria-hidden、意味は文字で伝える。checkに設定名だけを並べず、何を観察するかを書く。DiagnosticListにはDiagnosticItem以外の本文・moduleを直置きしない。

## Comparison

```ts
interface ComparisonProps {
  leftLabel: string;
  rightLabel: string;
  children: MDXContent;
}
```

child APIはrepresentative fixtureで固定する。

## LinkCard

```ts
interface LinkCardProps {
  href: string;
  title: string;
  description?: string;
  label?: string;
  external?: boolean;
}
```

runtime metadata fetchは禁止。

## Details

```ts
interface DetailsProps {
  summary: string;
  open?: boolean;
  children: MDXContent;
}
```

native `<details>` semantics。

## Demo

```ts
interface DemoProps {
  module: string;
  title?: string;
  description?: string;
}
```

`module`はInteractive Module Registry ID。MDXはReact import / hydration directiveを持たない。

## Deterministic diagrams

software / architecture記事のfactual visualではAI画像よりdeterministic diagramを優先できる。Mermaid等を採用する場合はbuild-time SVGへ変換し、client Mermaid runtimeをcontent routeへ送らない。

## Not allowed initially

- arbitrary component import
- raw HTML passthrough
- arbitrary JSX style prop
- storage-specific image component
- generic client-only widget
- article-local Tailwind layout builder

## AI authoring

AIへactive content-module registryとinteractive-module registry snapshotを渡す。unknown moduleを生成せずproposalにする。

## Durability

visual redesign、R2 domain変更、React source移動でMDXを書き換えないAPIを優先する。

## 図版の表示密度（レビュー候補）

`Gallery`の任意属性`layout="diagrams"`は比較用の小図を並べる。PCでは利用可能幅に応じた列、狭い画面では1列。各図を最大320 CSS pxとし、文字を大きく拡大しない。写真用の既存Galleryは既定`images`で従来表示を維持。`Figure width="compact"`は小さいアイコン列等を最大360 CSS pxで表示する。
Blogの先頭に通常段落がある場合、最大2段落を同じ書体・サイズでhero/目次より前に表示する。本文順を保ち、画像・注意・操作部品を導入として移さない。

図版の新規執筆は[図版標準](../content/figure-standard.md)の簡素な基本形を使う。caption/noteは互換性のための任意機能であり、本文や画像内の説明を繰り返す既定欄ではない。

## BarChart（横棒グラフ）

画像・外部ライブラリ・クライアントJSを使わず、比較値を静的HTMLとCSSで表示する。本文の数値を図示する部品であり、測定結果の正しさや根拠を保証するものではない。

- title: 必須の図題（1〜120文字）。
- unit: 必須の単位・指標名（1〜30文字）。
- max: 正の有限数を表す文字列。全行に同じ0始点の尺度を使う。値を超える上限を明示し、自動切り捨てはしない。
- rows: JSON配列の文字列（1〜30行）。各行はlabel、数値value、任意のnote、任意のtone（accent / muted）。valueは0以上かつmax以下。

MDX式・import・子要素を使わない。例：

```mdx
<BarChart title="処理速度の比較" unit="RTF" max="9000" rows='[{"label":"条件A","value":8930},{"label":"条件B","value":4790,"note":"描画あり","tone":"muted"}]' />
```

全値と注記は可視テキストとして表示し、棒や補助目盛りのみ読み上げ対象外とする。0の棒に最小幅を与えず、狭い画面ではラベルと値を縦に並べる。色だけに意味を持たせず、差の意味はlabel/noteでも伝える。
