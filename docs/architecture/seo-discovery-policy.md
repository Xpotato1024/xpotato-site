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

readerに有用なstatic HTML、stable URL continuity、正しいmetadata/archive/internal linksを公開する。

SEO authoring surfaceを最小化し、normal content signalsはsystem-derived。

site internal search architectureは`content-discovery-architecture.md`を正とし、ここではweb indexabilityを扱う。

## Author / system responsibility

normal authoring metadata:

- ContentId (executor)
- title/description
- pub/update date
- category/tags
- draft/editorial flags

system-derived:

- canonical URL
- title pattern
- social metadata
- hero/social card from Media Registry
- Article/BlogPosting JSON-LD
- sitemap/archive/RSS
- breadcrumb/related
- MiniSearch search-document metadata/index eligibility

SEO overrideはexception-only。

## Canonical / routes

canonical origin=`https://xpotato.net`。

indexable pageはself canonical。

route rename:

- same ContentId
- new canonical
- old permanent redirect
- sitemap/internal link update

をsame changeで扱う。

## Social / structured data

Blog:

- exactly one active hero
- exactly one active social card

Media Registryからabsolute public URL/dimensionsをderiveする。

AI imageへtitle textを描かせずactual metadataをdeterministic rendererで合成する。

JSON-LDはpageに実在するcontent/entityだけ。rating/FAQ等をrich-result目的で捏造しない。

## Taxonomy/archive

- active Blog categories -> static archive
- tag `archive=true` only
- Note subject `archive=true` only
- year archive where content exists
- pagination page1 duplicateなし、each self canonical
- query/client filter combinationをindexable URLとして増殖しない

## Search page

`/search/`:

- normal navigationからreachable
- `noindex`
- sitemap excluded
- query resultごとのserver-generated indexable URLなし
- MiniSearch results link canonical routes
- draft/noindex/search-ineligible contentをserialized indexへ含めない

site internal searchとGoogle等web indexingを混同しない。

MiniSearch/tokenizer変更はsearch UX contractでありcanonical URL/SEO schemaを変更しない。

## RSS

`/rss.xml`、initial max20 summary。

`<head>`へRSS alternate linkをbuild-time生成する。

RSSはreader subscription featureでありranking trickではない。

## Sitemap / robots

sitemap includes canonical public indexable routes only。

exclude:

- draft/noindex
- `/search/`
- redirect source
- non-indexable taxonomy
- preview/private routes

robots=crawl policy、noindex=index policy。役割を混同しない。

404はactual not-found semantics。

## Internal/related links

important contentはnormal `<a href>`。

archive/related/project/tool cross-linkはbuild-time generated可能。

SEO目的だけの大量link/keyword anchorは禁止。

related scoreはreader relevance優先。

## Citations

citationはvalidated SourceRef public representation。

backlink目的でcitation/external linkを増やさない。

## Performance

content/metadata/archive linksはstatic HTML。

search runtimeは`/search/`だけ。

normal content routeへMiniSearch/search JS/indexを送らない。

## Legacy URLs

old URL -> current canonicalはpermanent redirect優先。

path redirect=site、WordPress query/domain redirect=infra。

metadataだけでactive redirectと報告しない。

## Validation

- title/description/canonical
- ContentId/route consistency
- indexability
- social media registry resolution
- Blog hero/social policy
- structured data
- sitemap inclusion/exclusion
- `/search/` noindex/sitemap exclusion
- RSS
- archive metadata
- redirect graph
- 404
- no draft/noindex content in MiniSearch serialized index

## Sources

- https://developers.google.com/search/docs/crawling-indexing/canonicalization
- https://developers.google.com/search/updates
