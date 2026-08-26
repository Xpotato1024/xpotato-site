---
status: superseded
date: 2026-08-26
owner: architecture
superseded_by: 0020-minisearch-with-deterministic-japanese-tokenizer.md
---

# ADR-0016: Pagefind Extendedをstatic full-text searchに採用する

## Context

vNextはstatic-first siteであり、検索のためだけにserver / database / hosted search serviceを追加したくない。

一方、記事数が増えた場合、日本語technical contentのfull-text searchはtaxonomy navigationだけでは不足する。

search engineはcontent SoTではなく、generated contentから再構築可能であることが望ましい。

## Original decision

initial full-text search engineとしてPagefind Extendedを採用する案だった。

- Astro static build後のHTMLをindex
- generated search bundleをdeploy artifactへ含める
- Gitへsearch indexをcommitしない
- ExtendedのJapanese segmentation supportを利用
- search client runtimeは`/search/`だけでload
- archive / RSS / related contentはsearch engineへ依存しない

## Superseded reason

Pagefind 1.5.2で、日本語index時のLindera segmentationとbrowser query時の`Intl.Segmenter` segmentationがcompound wordで一致せず、自然な日本語queryが無関係結果へ崩れるopen issueが確認された。

xpotato-siteは日本語技術記事がprimary contentであるため、このcorrectness riskを初期production baselineとして受容しない。

upstream issueではgenerated bundle patchを含むworkaroundが検討されているが、Pagefind内部minified code patchをsite searchの恒久contractにしない。

ADR-0020でMiniSearch + repository-owned deterministic tokenizerへ置換する。

## Historical alternatives considered

### Custom JSON index + client search

当初はJapanese tokenization/rankingを自前保守する負担を理由に不採用だった。

後続評価ではMiniSearchがcustom tokenizerとserialized indexを提供し、search engine本体まで自作せずtokenization semanticsだけ所有できるため、この懸念は縮小した。

### Hosted search service

引き続き不採用。server/API/cost/privacy dependencyを検索だけのために増やさない。

### Searchなし

長期publishing platform goalと一致しない。

## References

- https://pagefind.app/docs/multilingual/
- https://github.com/Pagefind/pagefind/issues/1237
- `0020-minisearch-with-deterministic-japanese-tokenizer.md`
