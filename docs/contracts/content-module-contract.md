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
  caption?: string;
  credit?: string;
  sourceUrl?: string;
  width?: "content" | "wide" | "full";
}
```

`asset`はlogical media ID。storage URLではない。

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
