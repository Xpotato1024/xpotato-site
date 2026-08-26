---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - Blog frontmatter contract
  - content metadata derivation rules
---

# Blog Frontmatter Contract

## Goal

通常Blogでは、著者・AIがSEO boilerplateやasset storage detailを入力しない。

frontmatterはstable content identity、editorial metadata、exception-only overrideだけを保持する。

canonical URL、OGP、JSON-LD、archive membership、hero / social assetはsystemが導出する。

## Exact logical shape

```ts
interface BlogFrontmatter {
  id: ContentId;

  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;

  category: CategoryId;
  tags: TagId[];

  draft: boolean;
  featured?: boolean;

  legacyUrls?: string[];

  seo?: {
    canonicalOverride?: string;
    noindex?: boolean;
    titleOverride?: string;
    descriptionOverride?: string;
  };
}
```

per-entry `schemaVersion`は持たない。collection schema versionは`content-contracts` implementationが所有する。

## Required fields

- `id`
- `title`
- `description`
- `pubDate`
- `category`
- `tags`
- `draft`

`id`は`content-identity-contract.md`に従うmachine-generated stable identity。authorが意味を込めて手入力するfieldではない。

## Title / description

`title`は人間向けtitleの正本。

`description`は一覧 / meta description / share summaryの共通source。

通常は別`summary`を持たない。

## Date

ISO date。

`updatedDate`はmaterial content updateだけで更新する。formatting-only / typo-onlyで自動更新しない。

## Hero / social derivation

Blog mediaはMedia Asset Registryから`id`で解決する。

published Blog:

- exactly one active `role=hero`
- exactly one active `role=social_card`

frontmatterは:

- R2 object key
- domain
- camera / AI origin
- provider/model
- actual dimensions

を知らない。

## SEO derivation

- canonical URL = collection route + current slug
- OG title = `seo.titleOverride ?? title`
- meta / OG description = `seo.descriptionOverride ?? description`
- OG image = active `social_card`
- BlogPosting image = active hero / social policy
- sitemap = `draft=false && noindex!=true`

`seo`はexception-only。

## Legacy URLs

`legacyUrls`はredirect identity evidence。

recordしただけでredirect activeとはみなさない。

## Slug versus ID

slugをfrontmatter fieldにしない。

slugはfile path / route handleから導出する。

```text
id   = stable content identity
slug = mutable route identity
```

slug renameでも`id`を変えない。redirectを同じchangeで設計する。

## Validation

- ContentId globally unique
- title / description non-empty
- category active
- all tags valid
- duplicate tag禁止
- pubDate <= updatedDate if updated exists
- published Blog hero exactly one
- published Blog social card exactly one
- media provenance / visual audit valid where required
- legacy URL duplicate禁止
- canonical override absolute HTTPS URL
- draft=falseでpublication blocker 0
