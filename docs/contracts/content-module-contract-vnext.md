---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - MDX content module API policy vNext draft
---

# MDX Content Module Contract vNext

This file temporarily supersedes `content-module-contract.md` during proposed design review. Before design freeze, consolidate to one canonical contract.

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
