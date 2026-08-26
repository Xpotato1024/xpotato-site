---
name: revise-article-from-audit
description: Article Jobでvalidated audit findingsに限定して日本語技術記事draftを修正するときに使う。新規調査、全面rewrite、finding外の新主張追加、approvalには使わない。
---

# Revise Article from Audit

## Inputs

- current immutable draft
- current audit findings
- fixed evidence
- job requirements

## Rules

- findingごとにresolutionを示す。
- accepted findingの修正だけを行う。
- evidence範囲外の新しいmaterial claimを追加しない。
- unrelated stylistic rewriteを混ぜない。
- findingを消すために根拠条件を弱めない。
- unresolved findingは未解決として残す。

## Output

- revised draft candidate
- finding resolution ledger
- changed spans
- remaining blockers

revision回数やpublishはexecutorが管理する。
