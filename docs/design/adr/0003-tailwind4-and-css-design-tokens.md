---
status: proposed
date: 2026-08-25
owner: architecture
---

# ADR-0003: Tailwind CSS 4 + CSS design tokens

## Context

既存 site は Tailwind 3 と deprecated `@astrojs/tailwind` integration を使用している。visual redesign 前に styling toolchain を current supported path へ移す必要がある。

## Decision

- Tailwind CSS 4 を使用する。
- Astro の deprecated Tailwind integration ではなく Tailwind の Vite plugin を使用する。
- repeated visual decisions は CSS custom properties / Tailwind theme token に集約する。
- CSS-in-JS runtime は導入しない。

## Alternatives

### Pure CSS へ全面移行

技術的には可能だが、既存 utility-based implementation の全面書き換えに対する保守上の利益が現時点で不十分。

### Tailwind 3 維持

不採用。新規 redesign を legacy integration 上で行うと後続 migration で再編集が増える。

### Component UI framework 導入

不採用。個人サイト固有の visual language より library convention が先行しやすく、client dependency 追加も起こり得る。

## Consequences

visual redesign は token migration 後に行う。arbitrary value を全面禁止はしないが、反復値は token 化する。

## Evidence

`docs/references/external-sources.md` の Tailwind section を参照する。
