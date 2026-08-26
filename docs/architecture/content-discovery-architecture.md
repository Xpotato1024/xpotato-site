---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - content discovery architecture
  - archive and pagination generation
  - RSS generation
  - static site search architecture
  - related content generation
---

# Content Discovery Architecture

## Goal

記事数が増えても、authorがarchive / RSS / search index / related listを手作業で管理しない。

content discoveryはsource content + taxonomy / media registryからdeterministicに導出する。

## Layers

```text
MDX + frontmatter + registries
            |
            v
   build-time content catalog
      /       |        \
     /        |         \
archives   RSS/feed   related-content
     |
     v
static HTML pages
     |
     v
post-build Pagefind index
     |
     v
/search/ only client runtime
```

Pagefindはrebuildable search artifactであり、content SoTではない。

## Derived content catalog

buildで公開対象entryからinternal `ContentDiscoveryRecord`を導出する。

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
  indexable: boolean;
}
```

これはderived build objectであり、authorが手書きしない。

## Published set

normal public discoveryへ含める条件:

- `draft=false`
- routeがvalid
- content schema valid
- collection-specific publication gate valid

`seo.noindex=true`は検索エンジンindexabilityを制御するが、site内navigation / search inclusionは別policyである。

initial policyでは`noindex` contentはPagefind searchからも除外する。private / preview contentがsearch indexへ漏れないため。

## Blog archive

### Root

```text
/blog/
/blog/page/2/
/blog/page/3/
...
```

page 1は`/blog/`のみ。`/blog/page/1/`を生成しない。

### Category

```text
/blog/category/<slug>/
/blog/category/<slug>/page/2/
```

Taxonomy Registryのactive categoryから生成。

### Tag

`TagRecord.archive=true`のみ:

```text
/blog/tag/<slug>/
/blog/tag/<slug>/page/2/
```

### Year

記事が存在する年だけ:

```text
/blog/archive/<yyyy>/
```

必要になればyear archiveもpagination可能。

### Month

initial non-goal。

## Notes discovery

```text
/notes/
/notes/page/2/
/notes/subject/<slug>/
```

subject archiveは`NoteSubjectRecord.archive=true`のみ。

## Projects discovery

```text
/projects/
```

Project数が少ない間はstatus / technologyごとの大量indexable archiveを作らない。

client-side filterが必要になってもfilter stateを無制限なindexable URLとして生成しない。

featured / status / stackはbuild-time card ordering / groupingへ利用できる。

## Tools discovery

```text
/tools/
```

Tool Categoryでgroup / filter可能。

initially categoryごとの独立indexable routeは要求しない。

## Pagination

paginationはstatic generation。

page sizeはversion-controlled `DiscoveryProfile`で管理し、frontmatterへ置かない。

rules:

- empty page生成禁止
- page 1 duplicate URL禁止
- each page self-canonical
- previous/next normal `<a>` navigation
- JavaScriptなしで全pageへ到達可能
- out-of-range pageは404

## Ordering

### Blog / Notes

primary: `pubDate desc`

tie-break: stable ContentId / routeによるdeterministic ordering。

### Projects

featured groupでは`featuredOrder`、その他はstatus / date policyをbuild profileで定義する。

### Tools

featured / title等のdeterministic ordering。

## RSS

Blogのpublic feedをstatic生成する。

canonical endpoint candidate:

```text
/rss.xml
```

Feed itemsはpublished Blogだけ。

含む:

- title
- canonical link
- publication date
- updated date where supported
- description
- category/tag metadata where interoperable
- stable guid derived from ContentId / canonical site identity

feed item count / full-content versus summary policyはversion-controlled FeedProfileで定義する。

initially1本のsite Blog feedを標準とし、category/tagごとのfeedを大量生成しない。

Feed generationのためにruntime serverを導入しない。

## Related content

article pageのrelated contentはbuild-time deterministic calculation。

candidate signal:

- shared technology tags
- shared topic tags
- same Blog category / Note subject
- same collection
- publication recency as tie-breaker only

exact weights / max item countは`RelatedContentProfile`のmachine-readable SoT。

rules:

- current content自身を除外
- draft/noindex excluded
- retired taxonomyだけの一致へ過大weightを与えない
- same result input -> same order
- AI API / embedding APIをrequest-timeで使用しない

semantic search / embeddingを将来採用する場合もbuild-time optional artifactとし、current simple deterministic pathを置換するmaterial decisionとして扱う。

## Static full-text search

### Engine

Pagefind Extendedをinitial search engineとする。

理由:

- static HTMLをpost-build indexできる
- search server / database不要
- browserが必要なindex chunkだけ取得する
- extended buildがJapanese / Chinese indexing supportを持つ
- static site architectureと一致

Pagefind indexは`dist/`から再生成可能なbuild artifactでGitへcommitしない。

### Build order

```text
Astro build
  -> static HTML / assets
  -> Pagefind Extended index
  -> search validation
  -> deploy artifact
```

### Index scope

article/page templateで`data-pagefind-body`等を使い、本文を明示的にindex対象とする。

index対象:

- public indexable content body
- title
- description
- useful taxonomy labels

index除外:

- global nav/footer duplication
- draft/noindex
- hidden provenance
- unrelated UI text
- code copy button label等

### Search metadata / filters

Pagefind metadata/filterへ必要に応じて:

- collection
- Blog category
- tags
- pubDate

をbuild HTMLから渡せる。

filter ID / labelの正本はTaxonomy Registry。

### Search UI

initial canonical route:

```text
/search/
```

Pagefind client runtimeはsearch routeでのみloadする。

normal article / archive routeへPagefind JavaScriptを送らない。

initial UIはPagefind Component UIまたは同等のaccessible adapterを利用できる。site design tokenでstylingするが、search engine contractとUI packageを同一視しない。

site-wide modal searchを後から導入する場合、user interaction時だけdynamic importする設計を要求する。

### JavaScript budget

searchはinteractive featureなのでclient JSを許容するが、そのbundleをsearch利用者以外へ配信しない。

## Search result URLs

search indexはgenerated static HTMLのcanonical routesを使う。

ContentIdをpublic URLとして露出させる必要はない。

## Search staleness

PagefindはAstro build後に毎回生成する。

old search bundleとnew HTMLを別deploy revisionで混在させない。

search index + site distを同一deploy artifactとして扱う。

## Validation

- all archive routes deterministic
- no duplicate page-1 route
- archive item count equals filtered catalog count
- pagination links reachable
- RSS valid XML and public items only
- related content has no draft/current self
- Pagefind indexing succeeds after build
- representative Japanese queries return expected fixtures
- search result route exists
- no draft/noindex content in search index
- article route has no Pagefind JS

## External references

- Pagefind: https://pagefind.app/
- Pagefind documentation: https://pagefind.app/docs/

implementation時はcurrent Pagefind release / Japanese extended build behaviorを再確認する。
