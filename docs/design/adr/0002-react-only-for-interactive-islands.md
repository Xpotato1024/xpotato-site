---
status: proposed
date: 2026-08-25
owner: architecture
---

# ADR-0002: React は interactive island に限定する

## Context

Astro は UI framework component を client directive なしでは static HTML として出力できる。現在の repository で実際に hydrated React を必要としている代表例は PrimeFactorizer のような stateful tool である。

React を site-wide component default にすると、static content に不要な JavaScript と lifecycle complexity を持ち込みやすい。

## Decision

React integration は保持するが、React を site foundation としない。

- static structure: Astro
- trivial enhancement: native HTML/CSS / small TypeScript
- stateful interactive tool: React island

client directive は必要な最小 priority を選ぶ。below-the-fold tool は `client:visible` を第一候補とする。

## Alternatives

### React を完全削除

可能だが、stateful tools を vanilla implementation へ書き直すだけの architecture benefit が現時点では小さい。

### 全 UI を React 化

不採用。content route の hydration cost と client complexity が増える。

### 複数 UI framework を用途別採用

Astro は可能だが、small site では dependency / knowledge surface の増加が利益を上回るため標準化しない。

## Consequences

- content route では React client payload 0 を狙える。
- interactive tool は React ecosystem を利用できる。
- React dependency の存在だけを理由に static component を React 化しない。

## Evidence

`docs/references/external-sources.md` の Astro islands / web performance section を参照する。
