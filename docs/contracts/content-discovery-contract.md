---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - discovery profile schema semantics
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

exact numeric values are machine-readable config, not duplicated in docs.

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

`renderedContentHtml`は`contentMode=full`の場合のみ。

full feedを選択する場合も:

- internal media URLs resolved
- client-only interactive toolをfeedへ埋め込まない
- script/style injection禁止
- citation footnotes portable HTMLへrender

を要求する。

## Feed GUID

GUIDはcurrent slugだけから生成しない。

stable ContentId + canonical site identityからdeterministicに生成する。

slug renameで同じitem identityを維持できるようにする。

## Feed discovery

site `<head>`へ:

```html
<link rel="alternate" type="application/rss+xml" href="/rss.xml" />
```

相当をbuild-time生成する。

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

recencyは同scoreのtie-breakerとして利用できる。

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

resultはbuild-time ephemeral cacheでよく、Gitへcommit不要。

## Search document metadata

Pagefind用HTML metadataはDiscoveryRecordからrenderする。

logical metadata:

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

public Pagefind metadataへprivate provenanceを含めない。

## Search page SEO

`/search/`はinitially:

- `noindex`
- sitemap excluded
- normal navigation linkからreachable

とする。

query結果ごとのserver-generated URLを作らない。

## Pagefind artifact

Pagefind outputはstatic deploy artifactでGit非管理。

build fingerprintに:

- Pagefind version
- configuration hash
- indexed HTML tree hash / site build identity

を含められる。

## Search fixtures

Japanese technical content用fixtureを持つ。

最低限:

- 日本語一般語
- 英語技術用語
- mixed Japanese/English query
- product/framework name

についてexpected top-result setを検証する。

ranking exact orderを過度にsnapshotし、library minor tuningを困難にしない。critical queryのtop-k inclusionを中心にする。

## Machine-readable location

candidate:

```text
apps/site/src/content-registry/discovery.ts
```

または`packages/content-contracts` default profile + site-specific config。

exact numeric valuesのSoTは1か所だけにする。

## Validation

- positive page sizes / maxItems
- archive scope uses active taxonomy
- feed only includes published Blog
- GUID unique / stable
- related excludes self/draft/noindex
- Pagefind metadata uses valid route/taxonomy
- search page noindex
- generated archive count matches catalog
