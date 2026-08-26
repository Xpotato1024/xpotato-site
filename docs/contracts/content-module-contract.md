---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - MDX content module API policy
---

# MDX Content Module Contract

## Goal

記事ごとの表現自由度を保ちつつ、ad-hoc HTML / CSS / Reactを増やさない。

通常Markdownで足りない意味構造だけをapproved MDX moduleとして提供する。

exact runtime prop typesはimplementation TypeScriptをmachine-readable SoTとし、この文書はstable public authoring APIを定義する。

## Shared types

```ts
type WidthVariant = "content" | "wide" | "full";
type CalloutKind = "note" | "tip" | "warning" | "important";
```

visual color名をsemantic propに使わない。

## `Figure`

```ts
interface FigureProps {
  src: ImageMetadata | string;
  alt: string;
  caption?: string;
  credit?: string;
  sourceUrl?: string;
  width?: WidthVariant;
}
```

- `alt` required。decorative imageは通常Figureを使わず明示decorative pathを使う。
- `sourceUrl`はcredit sourceであり、image bytesの取得先とは限らない。

## `Gallery`

```ts
interface GalleryProps {
  label?: string;
  width?: "content" | "wide";
  children: MDXContent;
}
```

childは原則`Figure`。

column数等のvisual layoutをarticle authorが細かく指定しない。design systemがviewport / countから決める。

## `Callout`

```ts
interface CalloutProps {
  kind: CalloutKind;
  title?: string;
  children: MDXContent;
}
```

critical safety instructionをvisual colorだけで伝えない。

## `Steps` / `Step`

```ts
interface StepsProps {
  children: MDXContent;
}

interface StepProps {
  title: string;
  result?: string;
  children: MDXContent;
}
```

plain ordered listで足りる場合はMarkdown listを優先。

## `Comparison`

```ts
interface ComparisonProps {
  leftLabel: string;
  rightLabel: string;
  children: MDXContent;
}
```

child contentはimplementation-defined `ComparisonItem` pair等へ固定してもよいが、初期実装前に1件のrepresentative articleでAPIをfixture検証する。

Markdown tableで十分ならtableを優先。

## `LinkCard`

```ts
interface LinkCardProps {
  href: string;
  title: string;
  description?: string;
  label?: string;
  external?: boolean;
}
```

runtime fetchしない。AIがURLだけ置いてbuild時にunknown websiteへ自動fetchする設計にはしない。

## `Details`

```ts
interface DetailsProps {
  summary: string;
  open?: boolean;
  children: MDXContent;
}
```

native `<details>` semanticsを使用し、JSなしで動作する。

## `Demo`

```ts
interface DemoProps {
  title?: string;
  description?: string;
  children: MDXContent;
}
```

`Demo`はstatic container。内部interactive childがReact等の場合、child自身に明示`client:*` directiveを付ける。

`Demo` wrapperだけでsite-wide hydrationを発生させない。

## Not initial modules

- arbitrary columns / layout builder
- raw HTML passthrough
- arbitrary JSX style prop
- generic client-only widget
- custom color box

需要が反復した時点でsemantic moduleを追加する。

## Module registry

```ts
interface ContentModuleRecord {
  id: string;
  importPath: string;
  clientRuntime: "none" | "optional" | "required";
  allowedCollections: string[];
  status: "active" | "retired";
  apiVersion: number;
}
```

AI authoring requestにはregistry snapshotを渡し、存在しないcomponentを捏造させない。

## Styling ownership

module visual styleはdesign system側が所有する。

MDX本文へTailwind utilityを大量記述しない。

必要なlayout variationはsemantic propにする。

## Accessibility

module APIはalt、caption、heading semantics、keyboard behavior等を型で要求できるところまで要求する。

module authorが毎回ARIAを再設計しない。

## Migration durability

visual redesignでmodule implementationを変更しても、MDX call siteが大量変更にならないAPIを優先する。

breaking module API変更はcontent migrationを伴うためmaterial contract changeとして扱う。
