---
status: proposed
date: 2026-08-25
owner: architecture
---

# ADR-0001: Astro static-first + Cloudflare Workers Static Assets

## Context

このサイトは article、project、note、tool を中心とする content-oriented site であり、通常 request ごとの server rendering を必要としない。

既存 repo は Astro を使用しているが、運用文書に Cloudflare Pages / Workers / VPS の記述が混在している。

## Decision

- Astro を継続する。
- default output は build-time prerender / SSG とする。
- production は Cloudflare Workers Static Assets から `dist/` を配信する。
- Cloudflare adapter / `output: server` は標準構成に入れない。
- request-time runtime が必要になった route だけ別 ADR で再検討する。

## Alternatives

### Full React / Next.js application

不採用。現在の content-heavy workload に対し client / server runtime と framework surface を増やすが、必要な dynamic requirement がない。

### Hugo / Zola 等へ移行

Node build dependency は外せるが、既存 Astro component / MDX / island 資産の再実装コストに対して得る利益が小さい。

### Cloudflare Pages

利用可能だが、current Cloudflare guidance と既存 Wrangler static-assets configuration を踏まえ Workers Static Assets へ一本化する。

## Consequences

- production に Node server は不要。
- static route は CDN cache と単純な failure model を得る。
- dynamic feature 追加には明示的 architecture review が必要。
- Pages / VPS を current target とする旧文書は migration 時に legacy 化する。

## Evidence

`docs/references/external-sources.md` の Astro / Cloudflare section を参照する。
