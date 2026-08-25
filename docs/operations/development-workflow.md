---
status: proposed
owner: operations
last_verified: 2026-08-25
canonical_for:
  - development workflow
---

# Development Workflow

## Branching

`main` へ直接 commit / push しない。

変更は feature branch で行い、PR を通す。article typo のような小変更でも CI gate を迂回する理由にしない。

## Change classes

- content-only: article / metadata / small media
- frontend: component / style / interaction
- architecture: framework / routing / runtime / schema / dependency
- operations: CI / build / deployment
- legacy migration: old document / WordPress / redirect

architecture change は対応する canonical doc を更新し、material decision なら ADR を追加する。

## Design before migration

vNext migration は次の順で進める。

1. proposed docs をレビューし accepted にする。
2. baseline measurement / inventory を取得する。
3. toolchain / Astro Content Layer / Tailwind を更新する。
4. frontend boundary と content schema を移行する。
5. CI / performance budget / redirect validation を有効化する。
6. legacy docs / importer / assets を隔離する。
7. visual redesign を target architecture 上で実施する。

旧構成上で大規模 visual redesign を行い、その後 framework migration で同じ component を再編集する順序を避ける。

## PR scope

1 PR は review 可能な責務に絞る。framework major migration と全面 visual redesign を同じ PR にしない。

Skill 自体の改善は product change に便乗させず、可能なら独立差分とする。

## Review evidence

PR description に変更種別に応じて次を記録する。

- affected routes / collections
- validation command / result
- visual change がある場合の representative viewport evidence
- client JS / asset budget への影響
- accessibility manual smoke の必要性
- architecture / ADR update の有無

## Generated files

machine-generated artifact を手編集しない。generator / source を修正して再生成する。
