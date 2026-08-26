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
    engine: "minisearch";
    engineVersion: string;
    tokenizerId: string;
    includeCollections: Array<"blog" | "notes" | "projects" | "tools" | "pages">;
  };
}
```

## Initial site profile

2026-08-26 legacy inventoryはBlog 44件、Projects 6件、Notes 1件、Tools 1件、Pages 1件。

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
    weights: {
      sameCollection: 1,
      samePrimaryTaxonomy: 2,
      sharedTechnologyTag: 4,
      sharedTopicTag: 2,
    },
    minimumScore: 4,
  },
  search: {
    enabled: true,
    route: "/search/",
    engine: "minisearch",
    engineVersion: "7.2.0",
    tokenizerId: "xpotato-ja-tech-bigram-v1",
    includeCollections: ["blog", "notes", "projects", "tools", "pages"],
  },
} as const;
```

rationale:

- 12件/pageなら現行44 Blogを4 pageに分割できる。
- 12は2/3/4-column card layoutで扱いやすい。
- RSS full contentは長文/media/interactive contentをfeedへ複製するためinitially summary only。
- related max 4で本文末尾を過密にしない。
- broad `software` category + same collectionだけならscore=3でminimum未満。categoryだけでほぼ全software記事をrelated扱いしない。
- technology tag 1つ共有ならscore>=4で強い関係として候補になる。
- topic tagだけなら2つ共有、またはcategory等との組合せでminimumへ到達する。
- MiniSearch + same deterministic tokenizerでJapanese index/query segmentation driftを避ける。

これらはarticle metadataではなくsite-level machine profile。materialなUX/content volume変化時はprofile revisionとしてreviewする。

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

から生成する。Gitへ1件ずつ手書きしない。

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

`renderedContentHtml`はfuture `contentMode=full`時のみ。initial summary modeでは本文HTMLをfeedへ埋め込まない。

GUIDはstable ContentId + canonical site identityからdeterministicに生成し、slug renameでitem identityを維持する。

site `<head>`へRSS alternate linkをbuild-time生成する。

## Related score

candidate score:

```text
score =
  same collection ? 1 : 0
  + same primary category/subject ? 2 : 0
  + shared technology tags * 4
  + shared topic tags * 2
```

minimum=`4`、max items=`4`。

recencyは同scoreのtie-breakerだけに使用する。

rules:

- self excluded
- draft/noindex excluded
- retired tagだけの一致をnormal scoreへ使わない
- identical input -> identical result/order
- AI semantic similarity initial off

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

resultはbuild-time ephemeral artifactでGit非管理。

## SearchDocument

MiniSearch index inputはpost-build searchable regionからdeterministicに抽出する。

```ts
interface SearchDocument {
  id: ContentId;
  route: string;
  collection: "blog" | "notes" | "projects" | "tools" | "pages";
  title: string;
  description: string;
  taxonomyText: string;
  headingText: string;
  bodyText: string;
  cjkSingles: string;
  pubDate?: string;
}
```

stored result fieldsは:

- route
- collection
- title
- description
- pubDate

だけを基本とする。private provenance/source ledgerを含めない。

## Search tokenizer

exact profileは`../operations/static-search-profile.md`。

ID:

```text
xpotato-ja-tech-bigram-v1
```

requirements:

- build/indexとbrowser/queryでsame pure implementation
- Japanese/CJK primary = deterministic bigram
- CJK unigram = low-weight auxiliary field
- ASCII technical whole token + bounded sub-token
- runtime dictionary/ICU segmentation差へ依存しない

## Search page SEO

`/search/`:

- `noindex`
- sitemap excluded
- normal navigationからreachable
- query結果ごとのserver-generated URLなし

## Search artifact

MiniSearch serialized indexはstatic deploy artifactでGit非管理。

candidate path:

```text
dist/search/search-index.json
```

same atomic site deploy artifactに含める。

## Search ranking initial profile

relative field boost:

```text
title        6
taxonomy     3
heading      2
body         1
CJK unigram  0.25
```

- normal multi-term query AND優先
- fuzzy initial off
- CJK fuzzy/prefix expansion off
- 0-resultでunrelated approximate resultをsilent fallbackしない

## Search fixtures

最低限:

- Japanese compound: `新幹線`, `書き込み`, `機械学習`
- katakana: `プロテイン`, `マイグレーション`
- mixed: `WSL ネットワーク`, `Astro MDX`, `SQLite 書き込み`, `GPU 最適化`
- punctuation/technical: `C++`, `C#`, `GPT-5.6`
- draft/noindex exclusion

Pagefind issue reproductionとして、`新幹線` queryでgeneric `新...` pageがtrue targetより上位にならないfixtureを持つ。

## Machine-readable location

implementation target:

```text
apps/site/src/content-registry/discovery.ts
apps/site/src/search/tokenizer.ts
```

exact config/tokenizer sourceを1か所にする。

## Validation

- page sizes positive
- archive scope active taxonomy only
- feed public Blog only / max20 / summary
- GUID unique/stable
- related max4 / score formula deterministic / no self/draft
- MiniSearch version/tokenizer ID pinned
- build/browser tokenizer fixture same
- search index only eligible content
- Japanese/mixed regression top-k
- search page noindex
- generated archive count matches catalog
