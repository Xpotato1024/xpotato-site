---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - SEO and web discovery policy
  - indexable metadata contract
---

# SEO and Discovery Policy

## Principle

search engine向けの別contentを作るのではなく、readerに有用なstatic HTML、stable URL continuity、正しいmetadata/archive/internal linksを公開する。

SEO authoring surfaceを最小化し、normal contentではsystemがsignalsを導出する。

major contentをclient-side renderingへ依存させない。

site内full-text searchのarchitectureは`content-discovery-architecture.md`を正とし、この文書ではsearch-engine indexabilityだけを扱う。

## Author versus system responsibility

### Author / Article Job editorial metadata

normal Blogで必要なのは:

- stable ContentId (executor generated)
- title
- description
- pub/update date
- category
- tags
- draft/editorial flags

hero path、OG image path、canonical URL、JSON-LD fieldを手入力しない。

### System-derived

- canonical URL
- site title pattern
- social metadata
- hero/social card URL/dimensions from Media Registry
- Article/BlogPosting JSON-LD
- sitemap membership
- archive membership
- RSS membership/discovery link
- breadcrumb/related links where used
- Pagefind metadata/search index

`seo` overrideはexception-only。

## Canonical URL

canonical origin = `https://xpotato.net`。

indexable pageは原則self canonicalをoriginal HTML `<head>`に持つ。

canonical overrideはsyndicated/duplicate等の例外。

canonical、redirect、sitemap、internal linkが矛盾しない。

ContentIdをpublic URLへ埋め込む必要はない。

route rename:

- same ContentId
- new canonical route
- old route permanent redirect
- sitemap/internal link update

を同じchangeで扱う。

## Title / description

indexable routeは識別可能なtitle/descriptionを持つ。

- boilerplateだけにしない
- keyword repetitionのため本文と異なるtitleを作らない
- descriptionはreader-facing summaryとして成立させる
- search snippetを完全制御できると仮定しない

## Social metadata

### Blog

published Blog:

- active hero exactly one
- active social card exactly one

Media Registryから解決する。

social cardはactual title/category/brand + hero/design profileからdeterministic生成できる。

AI image modelへarticle title textを描かせない。

### Other collections

collection visual policyに従う。

hero optional/noneでも、必要なsocial metadata画像はsite-default background + actual metadata等でdeterministic derivation可能。

frontmatterへimage pathを追加しない。

social imageはabsolute public URLとknown dimensionsを持つ。

## Structured data

実際にpageへ存在するentity/contentだけをJSON-LDへ記述する。

Blog/Article candidate fields:

- headline/title
- description
- publication/update dates
- canonical URL
- representative image from current Media Registry
- author/site identity where actually defined

rich result目的でrating/review/FAQ等を捏造しない。

provider-supported featureは変化するためimplementation時にcurrent official docsを確認する。

## Taxonomy/archive SEO

archiveはreader discovery pageとして設計する。

### Blog category

active broad categoryのstatic archive。

registry descriptionをintro/metadataに利用可能。

### Blog tag

`archive=true`だけroute生成。

`indexable` flagでweb indexingを分離。

### Note subject

`archive=true`だけroute生成。

### Year archive

chronological discovery。

indexabilityはmachine policyで調整可能。

### Pagination

- page 1 duplicate route禁止
- each static page self canonical
- normal `<a>` navigation
- out-of-range 404

`rel=next/prev`をcritical canonical signalとして依存しない。navigation linkとしてprev/nextを提供する。

### Filter state

query/client filter combinationごとにindexable URLを増殖させない。

## Search page

initial `/search/`:

- reader navigationからreachable
- `noindex`
- sitemap excluded
- search query結果ごとのindexable server URLを作らない
- Pagefind result documentはcanonical content routeへlink

Pagefind indexへdraft/noindex contentを含めないinitial policy。

site search implementationとGoogle等のweb indexを混同しない。

## RSS discovery

RSS endpoint candidate `/rss.xml`。

site `<head>`へ`rel=alternate` RSS linkをbuild-time生成する。

feed URLをsitemap entryとして扱う必要はない。

RSSはsearch-engine ranking trickではなくreader/subscription discovery feature。

## Sitemap

canonical public indexable routesから生成。

exclude:

- draft
- noindex
- `/search/`
- redirect source
- non-indexable taxonomy archive
- private/preview route

URL renameではredirect + sitemap + internal linkをsame changeで更新。

## Robots / indexing

robots = crawl policy、noindex = index policy。

役割を混同しない。

preview/test environmentがpublicly reachableならindexabilityを明示的に防ぐ。

404はactual not-found semantics。soft 404 normal pageを返さない。

## Internal links

important contentはnormal `<a href>`でcrawl/read可能。

build-time generated:

- archive
- related content
- project/tool cross-link

を利用できる。

SEO目的だけの大量link / keyword anchor生成は禁止。

related rankingはreader relevanceを優先し、search engine向けlink sculptingを目的にしない。

## Citations and external links

citationはvalidated SourceRefのpublic representation。

citation URLの存在をSEO backlink目的として増やさない。

ordinary related external linkとfactual citationをsemanticに区別する。

## Performance relationship

SEOのためにclient widgetをglobal追加しない。

content、metadata、archive linksはstatic HTML。

search runtimeは`/search/`へ局所化。

Core Web Vitals targetと両立する。

## Legacy URLs

old URL -> current canonicalへpermanent redirect可能ならredirectを優先。

path redirectはsite owner、WordPress query/domain-level redirectはinfra owner。

legacy URL metadataだけでactive redirectとみなさない。

## Validation

- title/description
- canonical
- ContentId/route consistency
- indexability
- social image exists in registry and absolute URL derivable
- Blog hero/social-card policy
- structured data
- sitemap inclusion/exclusion
- search page noindex/sitemap exclusion
- RSS alternate link/endpoint
- taxonomy archive metadata/indexability
- redirect target/chain
- 404 semantics
- no draft/noindex content in Pagefind initial index policy

## Sources

- Google canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google Search updates: https://developers.google.com/search/updates
