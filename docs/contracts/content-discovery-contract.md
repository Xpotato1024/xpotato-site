---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - discovery profile schema semantics
  - initial discovery profile defaults
  - pagination/feed/related/search derived contracts
---

# Content Discovery Contract

## Principle

archive、pagination、feed、related、search metadataはcontent/frontmatterから導出する。

article authorがpage size、RSS inclusion、related score、search filterを個別指定しない。

## DiscoveryProfile

```ts
interface DiscoveryProfile {
  schemaVersion: 1;

  pagination: {
    blogPageSize: number;
    notesPageSize: number;
  };

  feed: {
    enabled: boolean;
    path: "/rss.xml";
    maxItems: number;
    contentMode: "summary" | "full";
  };

  related: {
    maxItems: number;
    weights: {
      sameCollection: number;
      samePrimaryTaxonomy: number;
      sharedTechnologyTag: number;
      sharedTopicTag: number;
    };
    minimumScore: number;
  };

  search: {
    enabled: boolean;
    route: "/search/";
    engine: "pagefind_extended";
    includeCollections: Array<"blog" | "notes" | "projects" | "tools" | "pages">;
  };
}
```

## Initial site profile

2026-08-26 legacy inventoryはBlog 44件、Notes 1件。

vNext initial defaults:

```ts
const initialDiscoveryProfile = {
  schemaVersion: 1,
  pagination: {
    blogPageSize: 12,
    notesPageSize: 12,
  },
  feed: {
    enabled: true,
    path: "/rss.xml",
    maxItems: 20,
    contentMode: "summary",
  },
  related: {
    maxItems: 4,
    // exact weights/minimumScore remain implementation-profile values
  },
  search: {
    enabled: true,
    route: "/search/",
    engine: "pagefind_extended",
    includeCollections: ["blog", "notes", "projects", "tools", "pages"],
  },
} as const;
```

rationale:

- 12件/pageなら現行44 Blogを4 pageに分割できる。
- 12は2/3/4-column card layoutで均等に扱いやすい。
- RSS full contentは長文、画像、interactive content、provider media URLの複製を増やすためinitially summary only。
- related 4件はarticle末尾を主contentより強くしすぎない。

これらはarticle metadataではなくsite-level machine profile。content volume/UXがmaterialに変わればprofile changeとしてreviewする。

related weights/minimumScore、Pagefind exact version/search adapterは実装/evalで確定する。

## ContentDiscoveryRecord

```ts
interface ContentDiscoveryRecord {
  contentId: ContentId;
  collection: "blog" | "notes" | "projects" | "tools" | "pages";
  route: string;
  title: string;
  description: string;

  pubDate?: string;
  updatedDate?: string;

  categoryId?: string;
  subjectId?: string;
  toolCategoryId?: string;
  tagIds: string[];

  featured: boolean;
  heroAssetId?: string;

  siteSearchEligible: boolean;
  webIndexable: boolean;
}
```

`siteSearchEligible`と`webIndexable`を分離する。

initial policyでは`webIndexable=false` contentをsite searchにも含めないが、schema上は別semanticとして保持する。

## Derivation

DiscoveryRecordはbuild-timeで:

- validated content frontmatter
- route map
- taxonomy registry
- media registry
- SEO policy

から生成する。

Gitへ1件ずつ手書きしない。

## Pagination record

```ts
interface PaginationPageRecord {
  collection: "blog" | "notes";
  scope:
    | { kind: "root" }
    | { kind: "category"; id: string }
    | { kind: "tag"; id: string }
    | { kind: "subject"; id: string }
    | { kind: "year"; year: number };

  page: number;
  totalPages: number;
  route: string;
  itemContentIds: ContentId[];
}
```

rules:

- page starts at 1
- page 1 route has no `/page/1/`
- no empty generated page
- item order deterministic

## Feed record

```ts
interface FeedItemRecord {
  contentId: ContentId;
  guid: string;
  title: string;
  description: string;
  canonicalUrl: string;
  pubDate: string;
  updatedDate?: string;
  categoryLabels: string[];
  tagLabels: string[];
  renderedContentHtml?: string;
}
```

`renderedContentHtml`はfuture `contentMode=full`時のみ。

initial `summary` modeでは本文HTMLをfeedへ埋め込まない。

## Feed GUID

GUIDはstable ContentId + canonical site identityからdeterministicに生成する。

slug renameで同じitem identityを維持する。

## Feed discovery

site `<head>`へRSS alternate linkをbuild-time生成する。

## Related score

candidate scoreはprofile weightsだけからdeterministic計算する。

conceptual:

```text
score =
  same collection weight
  + same category/subject weight
  + shared technology tags * weight
  + shared topic tags * weight
```

recencyは同scoreのtie-breaker候補。

AI semantic similarityをinitial rankingへ入れない。

## RelatedContentResult

```ts
interface RelatedContentResult {
  sourceContentId: ContentId;
  profileSha256: string;
  items: Array<{
    contentId: ContentId;
    score: number;
    reasonCodes: string[];
  }>;
}
```

resultはbuild-time ephemeral cacheでよい。

## Search document metadata

Pagefind用metadataはDiscoveryRecordからrenderする。

```ts
interface SearchDocumentMetadata {
  contentId: ContentId;
  collection: string;
  title: string;
  route: string;
  pubDate?: string;
  taxonomyIds: string[];
}
```

private provenanceをpublic search metadataへ含めない。

## Search page SEO

`/search/`はinitially:

- `noindex`
- sitemap excluded
- normal navigationからreachable

query結果ごとのserver-generated URLを作らない。

## Pagefind artifact

Pagefind outputはstatic deploy artifactでGit非管理。

build fingerprintにversion/config/site build identityを含められる。

## Search fixtures

最低限:

- 日本語一般語
- 英語技術用語
- mixed Japanese/English query
- product/framework name

についてexpected top-result setを検証する。

exact rank全体ではなくcritical queryのtop-k inclusionを中心にする。

## Machine-readable location

initial candidate:

```text
apps/site/src/content-registry/discovery.ts
```

exact numeric/config SoTは実装後ここ1か所へ置く。

## Validation

- initial/profile page sizes positive
- archive scope active taxonomyのみ
- feed public Blogのみ
- RSS max 20 / summary profile follows current config
- GUID unique/stable
- related excludes self/draft/noindex and max 4
- Pagefind metadata valid
- search page noindex
- generated archive count matches catalog
