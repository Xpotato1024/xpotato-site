---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0021: MiniSearch + deterministic Japanese tokenizerをstatic searchに採用する

## Context

xpotato-siteは日本語technical contentがprimaryで、search correctnessは長期publishing UXの一部である。

Pagefind Extendedはstatic post-build searchとして魅力的だったが、current 1.5.2ではJapanese compoundについてindex tokenizerとquery tokenizerの不一致が報告されている。

代表的には`新幹線`がindex側で`新 + 幹線`、query側で`新幹線`となり、fallbackがgeneric prefixへ崩れて無関係pageを上位化し得る。

Pagefind generated bundleをpatchするworkaroundは存在するが、upstream minified implementation detailへsite correctnessを結合することになる。

## Decision

initial static full-text searchとして:

- MiniSearch 7.2.0
- repository-owned tokenizer `xpotato-ja-tech-bigram-v1`
- build/search双方でsame pure tokenizer
- post-build serialized static index
- `/search/`だけroute-local search JS

を採用する。

Japanese/CJKはdictionary segmentationではなくdeterministic overlapping bigramをprimary tokenとする。

ASCII technical termはversioned ruleでwhole token + useful sub-tokenを生成する。

## Why MiniSearch

MiniSearchは:

- browser/Node両対応
- runtime dependency 0
- custom tokenizer
- field boosting/ranking
- JSON serialization/load

を提供する。

search engine/ranking全部を自作せず、xpotato-siteが必要なtokenization semanticsだけを所有できる。

## Why bigram rather than dictionary tokenizer

目的はlanguage morphologyの完全解析ではなく、個人technical corpusでnatural queryをstableにmatchingすること。

bigramは:

- index/queryで必ずsame result
- browser/Node ICU version差を受けない
- kanji/hiragana/katakana compoundへ一貫
- unknown technical/product termにもdictionary update不要

という性質を持つ。

single-character CJK queryはlow-weight auxiliary unigram fieldでbounded supportする。

## Search artifact

```text
Astro build
 -> searchable body extraction
 -> SearchDocument[]
 -> shared tokenizer
 -> MiniSearch serialized index
 -> static deploy artifact
```

search indexはGitへcommitしない。

search server/database/APIを追加しない。

## UI

site-owned Astro + small vanilla TypeScript search UIを初期標準とする。

Reactを検索だけのために追加しない。

IME composition、keyboard、loading/error/empty-resultを明示的に扱う。

## Ranking policy

initially:

- title strongest boost
- taxonomy/heading moderate boost
- body base weight
- CJK unigram auxiliary field low weight
- fuzzy disabled
- CJK approximate prefix expansionなし
- normal multi-term queryはAND優先

0 result時にunrelated approximate resultsをsilent表示しない。

## Consequences

Positive:

- Japanese index/query tokenizer mismatchを構造的に排除
- provider/service不要
- search runtimeはroute-local
- index rebuildはdeterministic
- tokenizer regressionをrepository fixtureで固定可能

Costs:

- Pagefindの自動HTML indexing/UIを使わない
- searchable text extractionとsmall search UIをsite側で所有
- corpus成長時にserialized index sizeを監視する必要

current content規模ではこのownership costは許容できる。

## Revisit trigger

- serialized search artifactがperformance budgetをmaterialに超過
- content count/sizeがclient-side in-memory searchに適さなくなる
- Pagefind等upstreamがJapanese same-tokenizer semanticsを提供しregression fixtureを満たす
- hosted/runtime searchが別requirementで既に存在する

## References

- https://www.npmjs.com/package/minisearch
- https://lucaong.github.io/minisearch/
- https://github.com/Pagefind/pagefind/issues/1237
- `../../operations/static-search-profile.md`
