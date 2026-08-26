---
name: revise-article-from-audit
description: Article Jobでvalidated audit findingsに限定して日本語技術記事draftを修正する。新規調査、全面rewrite、finding外の新主張、approvalには使わない。
---

# Revise Article from Audit

## Inputs

- current immutable draft
- current audit findings
- fixed evidence
- citation/source catalog
- technical example verification manifest
- job requirements

## Rules

- findingごとにresolutionを示す
- accepted findingの修正だけを行う
- evidence範囲外のnew material claimを追加しない
- unrelated stylistic rewriteを混ぜない
- citation sourceを勝手に差し替え/新規捏造しない
- code/command block変更はprevious verificationをstaleにする前提で扱う
- observed outputを手書きで補正してverification failureを隠さない
- findingを消すために根拠条件を弱めない
- unresolved findingは残す
- ContentId / route / media bindingをfinding外で変更しない

## Output

- revised draft candidate
- finding resolution ledger
- changed spans
- changed technical-example spans
- remaining blockers

revision回数、再example assessment、publishはexecutorが管理する。
