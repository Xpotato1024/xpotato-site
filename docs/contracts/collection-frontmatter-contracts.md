---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - Notes frontmatter contract
  - Projects frontmatter contract
  - Tools frontmatter contract
  - Pages frontmatter contract
---

# Collection Frontmatter Contracts

## Principle

frontmatterはeditorial metadataとcontent identityに必要な情報だけを持つ。

表示画像、R2 path、React component path、OG image、archive URL等のimplementation detailをfrontmatterへ持ち込まない。

Blogは`blog-frontmatter-contract.md`を正とする。この文書はBlog以外を定義する。

## Shared types

```ts
interface SeoOverride {
  canonicalOverride?: string;
  noindex?: boolean;
  titleOverride?: string;
  descriptionOverride?: string;
}

type LegacyUrl = string;
```

全collectionで:

- `title`は人間向け表示名の正本
- `description`は一覧 / metadataで共用可能な説明
- `draft=true`はpublic route / sitemap / feedsから除外
- `legacyUrls`はredirect identity evidenceでありredirect activationではない
- `seo`はexception-only

`summary`を通常fieldとして重複させない。

---

# Notes

## Purpose

学習メモ、調査メモ、実験メモ等。Blogよりeditorial completenessを要求しないが、public metadataとstable routeを持つ。

## Shape

```ts
interface NoteFrontmatter {
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;

  subject: NoteSubjectId;
  tags: TagId[];

  draft: boolean;
  legacyUrls?: LegacyUrl[];
  seo?: SeoOverride;
}
```

### Notes media

heroは必須にしない。

`role=hero`が存在すれば利用できるが、存在しない場合はtext-first list / site default social treatmentを使用する。

### Subject

`subject`はfree-form stringではなくNote Subject Registryを参照する。

Notes subject archiveはregistry policyから生成する。

---

# Projects

## Purpose

制作物、研究・開発projectをchronological articleではなくproject identity中心で公開する。

## Shape

```ts
interface ProjectFrontmatter {
  title: string;
  description: string;

  pubDate: string;
  updatedDate?: string;
  startedDate?: string;
  completedDate?: string;

  status:
    | "planned"
    | "active"
    | "paused"
    | "completed"
    | "archived";

  tags: TagId[];
  stack?: TechnologyTagId[];

  featured?: boolean;
  featuredOrder?: number;

  links?: {
    repository?: string;
    demo?: string;
    documentation?: string;
  };

  sourceAvailability?:
    | "public"
    | "private"
    | "mixed"
    | "not_applicable";

  draft: boolean;
  legacyUrls?: LegacyUrl[];
  seo?: SeoOverride;
}
```

## Removed legacy concepts

vNextでは次をfrontmatter標準fieldにしない。

- `summary`: `description`と重複
- `showRepoLink`: repository URLの有無とpresentationで決める
- `confidential`: public contentへprivate repository URL等を保存しない
- `coverImage`, `overviewImage`, `overviewPosition`: Media Asset Registry / design moduleへ分離
- free-form `technologies`: Technology-tag registryへ分離

## Project media roles

任意:

- `hero`
- `overview`
- `gallery`

featured projectで画像が必要なdesignの場合、rendererはmedia存在を要求するかdeterministic fallbackを使用する。frontmatterへpathを追加しない。

## Validation

- `featuredOrder`は`featured=true`のときだけ許可
- `completedDate`がある場合`startedDate <= completedDate`
- `stack`は`TagRecord.kind=technology`のみ
- private sourceのURLをpublic frontmatterへ入れない

---

# Tools

## Purpose

ブラウザ上で利用できるutility / calculator / visualizer等。

Toolの説明contentとinteractive implementationを分離する。

## Shape

```ts
interface ToolFrontmatter {
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;

  category: ToolCategoryId;
  tags: TagId[];

  featured?: boolean;
  draft: boolean;

  legacyUrls?: LegacyUrl[];
  seo?: SeoOverride;
}
```

## Interactive binding

published Toolは`Interactive Module Registry`にexactly one primary bindingを持つ。

MDX本文はReact / Vue等のsource pathを直接importしない。

現在のような:

```mdx
import PrimeFactorizer from "...";
<PrimeFactorizer client:visible />
```

をvNext authoring contractにしない。

rendererがcontent IDからprimary interactive moduleを解決する。

## Removed legacy concepts

- `summary`: descriptionと重複
- `previewImage`: Media Asset Registryへ分離
- component import / `client:*` directive: Interactive Module Registryへ分離

---

# Pages

## Purpose

About等の長期固定ページ。

chronological contentではないため`pubDate`をrequiredにしない。

## Shape

```ts
interface PageFrontmatter {
  title: string;
  description: string;
  updatedDate?: string;

  draft: boolean;
  legacyUrls?: LegacyUrl[];
  seo?: SeoOverride;
}
```

navigation membership / orderはsite navigation registryが所有し、Page frontmatterへ複製しない。

---

# Route derivation

- Blog: `/blog/<slug>/`
- Notes: `/notes/<slug>/`
- Projects: `/projects/<slug>/`
- Tools: `/tools/<slug>/`
- Pages: root-levelまたは明示page route registry

slugは通常file/content IDから導出する。

arbitrary slug overrideは標準fieldにしない。route renameはredirectと同時に扱う。

# Media rule

collection frontmatterはmedia storageを知らない。

画像はMedia Asset Registryからcontent ID / roleで解決する。

# Machine-readable SoT

実装時は`packages/content-contracts`のZod schemaをexact SoTとする。

この文書のTypeScript shapeは契約レビュー用であり、実装後に別の手書きtypeとして維持しない。