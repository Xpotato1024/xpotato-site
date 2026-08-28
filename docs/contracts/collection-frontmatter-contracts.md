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

frontmatterはstable content identity、editorial metadata、exception-only overrideだけを持つ。

表示画像、R2 path、React component path、OG image、archive URL等のimplementation detailを持ち込まない。

Blogは`blog-frontmatter-contract.md`を正とする。

## Shared

全collectionで`id: ContentId` required。

`id`は`content-identity-contract.md`に従うmachine-generated immutable identity。

```ts
interface SeoOverride {
  canonicalOverride?: string;
  noindex?: boolean;
  titleOverride?: string;
  descriptionOverride?: string;
}

type LegacyUrl = string;
```

common rules:

- title = human-facing name
- description = list / metadata共用説明
- draft=true = public route / sitemap / feedsから除外
- legacyUrls = redirect identity evidence
- seo = exception-only
- summaryを通常fieldとして重複させない

---

# Notes

```ts
interface NoteFrontmatter {
  id: ContentId;
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

NotesはBlogよりeditorial completenessを要求しないがstable public identityを持つ。

heroはrequiredではない。存在すればMedia Registryから解決する。

`subject`はNote Subject Registry ID。

---

# Projects

```ts
interface ProjectFrontmatter {
  id: ContentId;
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

- `summary`: descriptionと重複
- `showRepoLink`: link存在とpresentationで決める
- `confidential`: private URLをpublic metadataに保存しない
- `coverImage` / `overviewImage` / `overviewPosition`: Media Registry / design moduleへ分離
- free-form `technologies`: technology tag registryへ分離

## Media

optional roles:

- hero
- overview
- gallery

frontmatterはpathを知らない。

## Validation

- featuredOrderはfeatured=trueのみ
- started/completed date consistency
- stackはtechnology tagのみ
- private source URLをpublic frontmatterへ入れない

---

# Tools

```ts
interface ToolFrontmatter {
  id: ContentId;
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

published ToolはInteractive Module Registryにexactly one active primary bindingを持つ。

Tool MDXはReact / Vue等を直接importせず、hydration directiveも持たない。

removed:

- summary
- previewImage
- component import / `client:*`

---

# Pages

```ts
interface PageFrontmatter {
  id: ContentId;
  title: string;
  description: string;
  updatedDate?: string;

  draft: boolean;
  legacyUrls?: LegacyUrl[];
  seo?: SeoOverride;
}
```

chronological contentではないためpubDate requiredではない。

navigation membership / orderはnavigation registry所有。

---

# Route derivation

- Blog: `/blog/<slug>/`
- Notes: `/notes/<slug>/`
- Projects: `/projects/<slug>/`
- Tools: `/tools/<slug>/`
- Pages: root-levelまたはexplicit page route registry

slugは通常file pathから導出する。

**ContentIdからslugを導出しない。**

route renameでもsame ContentIdを維持しredirectを同じchangeで作る。

# Media

frontmatterはmedia storageを知らない。

Media Asset RegistryはContentId + semantic asset ID / roleで解決する。

# Machine-readable SoT

implementationでは`packages/content-contracts` Zod schemaをexact SoTとする。
