---
status: proposed
date: 2026-08-25
owner: architecture
---

# ADR-0006: site-wide client router を default にしない

## Context

Astro は通常の full-page browser navigation で十分に機能する。client router は transition / persistent UI 等を実現できる一方、script lifecycle、history、scroll、accessibility、client behavior の surface を増やす。

この site の primary workload は article / project / tool discovery であり、SPA navigation requirement は現時点でない。

## Decision

- browser-native navigation を default とする。
- site-wide Astro ClientRouter を導入しない。
- visual transition requirement が出た場合、CSS / native mechanism を先に検討する。
- client router を採用する場合は performance / accessibility / lifecycle の evidence と ADR を要求する。

## Alternatives

### ClientRouter をデザイン基盤として最初から導入

不採用。必要性が未確定なのに client runtime complexity を baseline にする。

## Consequences

navigation は robust な document navigation semantics を維持する。transition は progressive enhancement として扱う。
