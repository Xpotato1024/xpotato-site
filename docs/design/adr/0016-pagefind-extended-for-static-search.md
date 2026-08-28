---
status: rejected
date: 2026-08-26
owner: architecture
replaced_by_proposal: 0021-minisearch-with-deterministic-japanese-tokenizer.md
---

# ADR-0016: Pagefind Extendedをstatic full-text searchに採用する — Rejected

## Context

vNextはstatic-firstで、日本語technical contentの全文検索をserver/databaseなしで提供したい。

Pagefind Extendedはpost-build static indexとJapanese segmentation supportを提供するため初期候補だった。

## Proposed decision that was rejected

- Astro build後のHTMLをPagefind Extendedでindex
- generated bundleをdeploy artifactへ含める
- `/search/`だけclient runtime
- search indexはGit非管理

## Rejection reason

Pagefind 1.5.2について、日本語のindex-time segmentationとbrowser query-time segmentationがcompound wordで一致せず、自然なqueryが無関係結果へ崩れるupstream issueが確認された。

xpotato-siteは日本語がprimaryなので、このcorrectness riskをinitial production baselineとして採用しない。

Generated/minified Pagefind bundleへsite-specific patchを当てるworkaroundも、upstream internal implementationへsearch correctnessを結合するため採用しない。

## Replacement proposal

ADR-0021 proposes MiniSearch + repository-owned deterministic Japanese/technical tokenizer。

ADR-0021 itself remains Proposed until Design Freeze acceptance。ADR-0016は一度もAcceptedではないため`superseded`ではなく`rejected`として履歴を残す。

## Alternatives retained

Hosted/runtime searchは検索だけのためのserver/API/cost/privacy dependencyを増やすためinitially不採用。

## References

- https://github.com/Pagefind/pagefind/issues/1237
- `0021-minisearch-with-deterministic-japanese-tokenizer.md`
