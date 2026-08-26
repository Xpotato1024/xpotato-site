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

## Initial module set

### `Figure`

用途: 画像 + caption / credit / source。

```mdx
<Figure
  src={image}
  alt="NAS内部のメモリスロット"
  caption="標準SO-DIMMスロットは基板中央にある"
/>
```

### `Gallery`

用途: 複数画像を意味のある1groupとして表示。

module側がresponsive layoutを所有し、記事側でgrid classを直接書かない。

### `Callout`

variant:

- `note`
- `warning`
- `important`
- `tip`

色名をvariantにしない。

### `Steps`

tutorial / procedureのordered semantic group。

普通のMarkdown ordered listで十分ならそちらを使う。rich step header / result等が必要な場合だけ使用。

### `Comparison`

A/Bやbefore/afterの比較。

表で十分ならMarkdown tableを優先。

### `LinkCard`

reference / related project / external official sourceをカード表示。

URL previewをrequest-time取得しない。build-time fixed metadataかexplicit propsを使用。

### `Details`

補足・長いlog等の折りたたみ。

native `<details>` semanticsを利用し、JavaScriptを要求しない。

### `Demo`

stateful interactive componentを記事へ埋め込む唯一のgeneric boundary。

`Demo`はReactそのものではなくcontainer contract。内部implementationがReact islandを必要とする場合だけhydrateする。

## Not initial modules

- arbitrary columns / layout builder
- raw HTML passthrough
- arbitrary JSX style prop
- generic client-only widget
- custom color box

需要が反復した時点でsemantic moduleを追加する。

## Module registry

machine-readable registryで次を保持する。

```ts
interface ContentModuleRecord {
  id: string;
  importPath: string;
  clientRuntime: "none" | "optional" | "required";
  allowedCollections: string[];
  status: "active" | "retired";
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
