---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0009: cache policy を artifact identity ごとに分離する

## Context

HTML は deploy 後すぐ更新される必要がある一方、content hash を含む CSS / JavaScript / image variant は URL が変わらない限り内容も変わらない。

同じ cache TTL をすべてへ適用すると、HTML の stale risk か、fingerprinted asset の不要 revalidation のどちらかが発生する。

Cloudflare Workers Static Assets は static asset を edge cache し、既定で browser revalidation 用 ETag / Cache-Control を返す。また `_headers` で fingerprinted asset を長期 immutable cache にできる。

## Decision

- HTML / stable control file は revalidation-oriented cache。
- fingerprinted `/_astro/*` asset は long-lived immutable browser cache。
- versioned R2 asset も immutable cache 候補。
- cache busting は query parameter より content-addressed / versioned URL を優先する。
- request-time Worker を cache optimization のためだけに導入しない。
- zone-level Cache / Compression Rules は `Xpotato-Server` が owner。

## Alternatives

### 全 static file を 1 年 cache

HTML update propagation を壊すため不採用。

### 全 file を常に revalidate

correct だが fingerprinted build asset の repeat navigation を不必要に増やすため不採用。

### custom Worker cache layer

Static Assets の既存 cache model で足りる baseline では operational complexity が過剰。

## Consequences

- `_headers` / production smoke で cache class を検証する。
- immutable を付ける path は content identity が URL に反映されている必要がある。
- R2 の同一 key overwrite policy と cache policy を同期する。

## Evidence

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developers.cloudflare.com/speed/optimization/content/compression/
