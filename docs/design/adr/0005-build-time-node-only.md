---
status: proposed
date: 2026-08-25
owner: architecture
---

# ADR-0005: Node.js は build-time toolchain に限定する

## Context

Astro の build には Node.js が必要だが、static site の production 配信には Node process は不要である。既存 README は特定 WSL path と Node 20 container command を直接記述している。

2026-08-25 時点で Node 20 は EOL。Node 24 は LTS で、Astro 7 の Node >=22.12 requirement を満たす。

## Decision

- vNext migration baseline は Node 24 LTS。
- exact version は repository toolchain / build image に pin する。
- local host への Node 常設 install を requirement としない。
- build container / CI / provider build で Node を使用する。
- production artifact に Node / npm / node_modules を含めない。

## Alternatives

### Host Node を必須にする

簡単だが developer machine state に依存し、現在の container-oriented workflow より再現性が下がる。

### Node を完全排除して別 SSG へ移行

Astro 資産の再実装コストに見合わないため不採用。

## Consequences

Node upgrade は build concern に閉じる。runtime security / operations に Node server patching を持ち込まない。

## Evidence

`docs/references/external-sources.md` の Node / Astro prerequisites section を参照する。
