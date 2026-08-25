---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - system architecture
  - runtime boundary
---

# System Architecture

## Target

`xpotato-site` は content-oriented な static-first site とする。

通常ページは build 時に prerender し、production では生成済み HTML / CSS / JavaScript / assets を Cloudflare Workers Static Assets から配信する。Astro の server output、Cloudflare adapter、常駐 Node.js server は標準構成に含めない。

```text
MDX / Astro / TypeScript / assets
            |
            | build only
            v
       Node.js toolchain
       Astro / Vite
            |
            v
          dist/
            |
            v
Cloudflare Workers Static Assets
            |
            +---- browser

heavy public assets --------> Cloudflare R2
shared Cloudflare/DNS state -> Xpotato-Server
```

## Architecture decisions

- SSG / prerender を default とする。
- request-time SSR を使用しない。
- database、CMS backend、session、server-side personalization を標準依存にしない。
- Cloudflare Pages と Workers Static Assets を併記しない。vNext の production target は Workers Static Assets とする。
- Node.js は build environment にのみ存在してよく、本番 runtime の依存ではない。
- R2 は大容量公開 asset 用であり、application source や content body の正本ではない。

## Dynamic feature gate

次の要求が発生した場合のみ request-time Worker / SSR を再検討する。

- 認証済みユーザーごとの server-side personalization
- secret を必要とする API
- request-time data access が UX / correctness 上不可欠
- static generation では表現できない server-side mutation

導入には ADR が必要で、static-only から外れる route、runtime、security、cache、failure mode、cost を明示する。

## Browser boundary

ブラウザへ送る JavaScript は opt-in とする。通常の navigation、article rendering、card、layout、SEO は JavaScript runtime を必要としない。

interactive feature は page-local island または小さな progressive enhancement として実装する。サイト全体を SPA としない。

## Asset boundary

- source-controlled / build-optimized asset: repository 内で管理。
- passthrough static file: `public/`。
- heavyweight / distributable binary: R2。
- R2 の content-bound asset は原則 immutable key を使い、Git revision を戻した際に意味が変わる同一 URL 上書きを避ける。

詳細は `content-architecture.md` と `performance-accessibility-policy.md` を正とする。

## Infrastructure boundary

サイト repo は以下を所有する。

- application source
- content source
- build contract
- canonical site URL semantics
- application-level route / redirect requirement
- deploy artifact contract

`Xpotato-Server` は以下を所有する。

- Cloudflare account / zone の current fact
- DNS
- R2 bucket など共有 provider resource の inventory / desired infrastructure
- zone-level policy / provider-level redirect rule が必要な場合の infrastructure definition

provider ID をサイト docs へ固定しない。

## Non-goals

- framework を増やして技術デモ化すること
- full SPA 化
- runtime Node.js server の運用
- headless CMS の導入自体を目的化すること
- static page に React hydration を付けること

## Sources

外部仕様の provenance は `../references/external-sources.md` を参照する。
