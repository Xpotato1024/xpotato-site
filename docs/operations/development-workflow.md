---
status: proposed
owner: operations
last_verified: 2026-08-26
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
- Article Job: pipeline / provider / artifact / AI exchange
- legacy migration: old document / WordPress / redirect

architecture change は対応する canonical doc を更新し、material decision なら ADR を追加する。

## Design before migration

vNext migration は次の順で進める。

1. proposed docs / contracts をレビューし accepted にする。
2. baseline measurement / inventory を取得する。
3. legacy tagを固定する。
4. npm workspace skeletonを作る。
5. `content-contracts` / site foundation / Astro Content Layer / Tailwindを構築する。
6. content / media / route parityを確立する。
7. 旧implementationをactive treeから削除する。
8. Article Job / media-ingest toolchainを実装する。
9. visual redesignをtarget architecture上で実施する。

旧構成上で大規模 visual redesign を行い、その後 framework migration で同じ component を再編集する順序を避ける。

## Workspace ownership

- `apps/site`: static public website
- `packages/content-contracts`: shared schema / registry
- `packages/article-pipeline`: Article Job
- `packages/media-ingest`: deterministic source media normalization
- `packages/site-validators`: deterministic repository / candidate checks

workspace boundaryを跨ぐimportは`repository-layout-vnext.md`のdirectionに従う。

## PR scope

1 PR は review 可能な責務に絞る。framework major migration と全面 visual redesign を同じ PR にしない。

初期greenfield migrationでは大きなdelete/add diffを避けられないが、少なくとも:

- workspace skeleton
- site foundation
- content migration
- media migration
- old implementation removal
- Article Job
- redesign

を分離する。

Skill 自体の改善は product change に便乗させず、可能なら独立差分とする。

## Article Job generated changes

Article Job exportはfeature branch working tree / patchまで。

AI-generated candidateをmainへ直接commitしない。

PR本文では少なくとも:

- candidate hash
- human approval presence
- content / visual audit result
- source / evidence summary location
- validation result

を追跡可能にする。

private source / prompt / job workspace全体をPRへ貼らない。

## Review evidence

PR description に変更種別に応じて次を記録する。

- affected routes / collections
- validation command / result
- visual change がある場合の representative viewport evidence
- client JS / asset budget への影響
- accessibility manual smoke の必要性
- architecture / ADR update の有無
- migration inventory impact where applicable

## Generated files

machine-generated artifact を手編集しない。generator / source を修正して再生成する。

対象例:

- JSON Schema
- social card derivative
- generated redirect artifact
- build inventory

## Legacy source access

旧source確認はlegacy tagを明示refとして読む。

current implementation探索でlegacy refを自動検索対象にしない。
