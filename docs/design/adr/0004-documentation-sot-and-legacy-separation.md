---
status: proposed
date: 2026-08-25
owner: architecture
---

# ADR-0004: `docs/` を vNext SoT とし旧 `doc/` を legacy に分離する

## Context

この repository は SoT / ADR governance 導入前から存在し、README、`doc/`、code に異なる時点の deployment / architecture assumption が残っている。

既存文書をその場で書き換えると、移行前 state と target design が混ざり provenance を失う。

## Decision

- 新しい `docs/` を vNext documentation root とする。
- `docs/README.md` を Source of Truth Map とする。
- existing `doc/` は migration source / legacy として一旦 untouched にする。
- ADR は current SoT と分離する。
- implementation migration 完了後、必要な legacy evidence だけ `docs/legacy/` から辿り、不要な旧文書は Git history に委ねる。

## Alternatives

### 既存 `doc/` を直接 current 化

不採用。旧運用記述を編集しながら target を定義するため current / target の境界が曖昧になる。

### README を巨大な SoT にする

不採用。agent / human の entrypoint と詳細 architecture の責務が混ざる。

## Consequences

migration 中は docs が target、code が current implementation evidence という二層が存在する。文書は implementation status を誤認させないよう明示する。
