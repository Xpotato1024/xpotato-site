---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0016: Pagefind Extendedをstatic full-text searchに採用する

## Context

vNextはstatic-first siteであり、検索のためだけにserver / database / hosted search serviceを追加したくない。

一方、記事数が増えた場合、日本語technical contentのfull-text searchはtaxonomy navigationだけでは不足する。

search engineはcontent SoTではなく、generated HTMLから再構築可能であることが望ましい。

## Decision

initial full-text search engineとしてPagefind Extendedを採用する。

- Astro static build後のHTMLをindex
- generated search bundleを`dist`の一部としてdeploy
- Gitへsearch indexをcommitしない
- Pagefind ExtendedのJapanese indexing supportを利用
- search client runtimeはinitially`/search/`routeだけでload
- archive / RSS / related contentはPagefindへ依存しない

exact package / binary versionはimplementation dependency SoTでpinする。

## Why Extended

Pagefindのextended releaseはChinese / Japanese indexing向けsupportを含む。

通常npm wrapperはextended binaryを提供するため、Node build toolchainとの統合も容易。

## Alternatives

### Custom JSON index + client fuzzy search

不採用。小規模では簡単だが、記事増加時にindex全量download / Japanese tokenization / ranking / chunkingを自前で保守することになる。

### Hosted search service

不採用。server/API key/cost/privacy/availability dependencyを検索だけのために増やす。

### Searchなし

初期少数記事では成立するが、publishing platformの長期scale goalと一致しない。

### Runtime semantic/vector search

初期不採用。search quality向上余地はあるが、embedding generation/storage/runtime APIを導入するほどのrequirementがまだない。

## UI

Pagefind engine採用は特定UIへの永久固定を意味しない。

initiallyPagefind Component UI等を使えるが、UIはadapterとして交換可能にする。

site-wide React search componentは要求しない。

## Consequences

- build pipelineにpost-Astro indexing stageが増える
- search pageのみclient JavaScriptを持つ
- Japanese representative query fixtureをCIで持つ必要がある
- Pagefind major updateはindex/output behaviorをvalidationして更新する
- Pagefindが将来不適切になってもcontent/archives/feedは影響を受けない

## References

- https://pagefind.app/
- https://pagefind.app/docs/
- `architecture/content-discovery-architecture.md`
