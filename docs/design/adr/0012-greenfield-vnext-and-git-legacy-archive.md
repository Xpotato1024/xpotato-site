---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0012: vNext実装はgreenfield rebuildとし、旧codeはGitでarchiveする

## Context

現行repositoryはSoT / ADR導入前の構造を持ち、旧Content Collections、旧Tailwind integration、過去のdeployment前提、WordPress migration artifactがactive treeへ混在している。

vNextではfrontend、content model、media、SEO、Article Jobまで責務を再定義するため、既存directory layoutを維持したincremental refactorは古い責務境界を引きずる可能性が高い。

一方、旧sourceを`archive/` directoryへ丸ごと移すとactive tree内にlegacy dependencyとimplementationが残る。

## Decision

- implementation cutover前の旧siteをimmutable Git tagで保存する。
- optional legacy branchは運用上必要な場合だけ作る。
- active implementation treeはvNext target layoutへ再構築する。
- full legacy source copyをvNext mainの`archive/`へ保持しない。
- repo内にはmigration inventory / compatibility evidence / redirect identityだけを残す。
- Git history rewrite / orphan repository化は行わない。

## Consequences

利点:

- active code searchがcurrent implementationだけになる
- agent / developerがlegacy codeを誤認しにくい
- dependency / build configurationを完全に整理できる
- rollback sourceはGit tagから取得可能

コスト:

- migration diffは大きくなる
- old/new componentの逐次比較はGit refを跨いで行う必要がある
- content migration inventoryとvalidationが重要になる

このtrade-offは、長期保守性を優先して受け入れる。
