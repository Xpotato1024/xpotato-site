---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - static content delivery optimization
  - cache class policy
  - compression policy
---

# Content Delivery Policy

## Goal

static-first site の単純性を保ったまま、browser / Cloudflare edge へ送る bytes、round trip、再取得を減らす。

optimization は content type / artifact identity に応じて行い、すべてへ同じ TTL や preload policy を適用しない。

## Delivery path

```text
Astro build
   |
   +-- HTML
   +-- hashed CSS / JS
   +-- hashed local image variants
   +-- public control files
   v
Cloudflare Workers Static Assets
   v
browser

R2 versioned media
   +-- optional Cloudflare Image Transformations
   v
browser
```

request-time application Worker を cache optimization のためだけに標準導入しない。

## Artifact classes

### HTML documents

HTML は更新反映を優先する。

長期 immutable browser cache にしない。Cloudflare Workers Static Assets の ETag / revalidation model を利用し、deploy 後に古い HTML が長期間 browser に固定されないようにする。

HTML filename へ content hash を含めることは routing contract と相性が悪いため行わない。

### Fingerprinted build assets

Astro / Vite が hash を付ける CSS / JavaScript / image variant は immutable asset とする。

`/_astro/*` 等の fingerprinted path には long-lived browser cache + `immutable` を設定する。

hash が変われば URL が変わるため purge を前提にしない。

### Versioned R2 assets

content-bound R2 media は immutable / versioned key を使用し、長期 cache を可能にする。

同一 key を差し替える asset は immutable と宣言しない。

### Stable control files

`robots.txt`、sitemap、manifest 等は更新され得るため fingerprinted asset と同じ cache policy にしない。

## Static Assets cache behavior

Cloudflare Workers Static Assets は static asset を edge cache し、browser response には既定で `Cache-Control: public, max-age=0, must-revalidate` と ETag を付与する。

fingerprinted asset だけ `_headers` でより長い browser cache に上書きする。

初期 target 例:

```text
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

exact path / TTL は deployment implementation と validation で確認する。

## Compression

text response は Cloudflare edge compression を利用する。

baseline:

- Brotli
- Gzip fallback

Zstandard が infrastructure plan / rule で利用可能なら有効化を検討する。

compression rule は zone-level infrastructure concern のため `Xpotato-Server` が owner。site repo は「text asset が圧縮配信される」という delivery requirement と検証を持つ。

precompressed `.br` / `.gz` を repository へ大量 commit する方式は標準にしない。

## JavaScript and CSS

- route に不要な JavaScript を生成・import しない。
- interactive island は route-local chunk にする。
- CSS は build minification / tree elimination を利用し、global CSS へ page-local style を無制限に積まない。
- third-party JavaScript は security / privacy / performance review を通す。

## Resource hints

`preload`、`preconnect`、aggressive prefetch は「付ければ速い」設定として乱用しない。

- LCP image / critical font 等、実測で early fetch が必要な resource だけ preload 候補。
- default system font では external font preconnect を持たない。
- next-page prefetch は user intent / bandwidth cost を評価して導入する。

## Images

local article image は `media-pipeline.md` に従い build-time responsive variants を生成する。

R2 media は、必要な場合だけ Cloudflare Images Transformations を利用し、width / format negotiation を edge で行う。

元の 12MP / 48MP camera image をそのまま viewport へ配信しない。

## Cache ownership

site repo:

- artifact class
- hashed / immutable contract
- `_headers` 等 application-local response header
- representative delivery validation

`Xpotato-Server`:

- zone-level Cache Rules
- Compression Rules
- provider-specific performance setting
- R2 resource policy

同じ cache rule を両 repo に重複定義しない。

## Validation

representative production / preview artifact で次を確認する。

- HTML cache header / ETag
- fingerprinted asset の immutable header
- CSS / JS compression
- route別 JavaScript payload
- responsive image `srcset` / selected width
- LCP image loading behavior
- R2 asset cache policy where used
- accidental redirect chain / cross-origin asset latency

## Sources

- Workers Static Assets caching: https://developers.cloudflare.com/workers/static-assets/
- Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- Cloudflare content compression: https://developers.cloudflare.com/speed/optimization/content/compression/
- Cloudflare Images transformations: https://developers.cloudflare.com/images/optimization/transformations/overview/
