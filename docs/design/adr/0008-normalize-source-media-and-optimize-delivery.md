---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0008: camera source を ingest で正規化し responsive image を自動生成する

## Context

記事画像は iPhone で撮影することが多く、High Efficiency 設定では HEIF / HEIC が生成される。

HEIC は source として効率的だが、author が毎回手変換したり、raw file を `public/` へ置いたりすると、publishing friction、metadata privacy、responsive delivery、Git history の問題が生じる。

Astro の local image pipeline は `src/` 内 asset を build-time optimization できる一方、`public/` の画像は optimization 対象外である。

## Decision

- HEIC / HEIF を first-class ingest input とする。
- raw source は public repository / public R2 の standard asset にしない。
- ingest step で orientation、sRGB、metadata strip、size、filename を正規化する。
- typical article image は normalized web master を `src/assets/content/...` に置く。
- ordinary image は Markdown syntax から responsive `srcset` / modern format を生成できる構成を採用する。
- large / high-volume media は versioned R2 master + optional Cloudflare Images Transformations を選択できる。
- author が AVIF / WebP variant を手作業で管理しない。

## Alternatives

### iPhone を JPEG 撮影へ固定

不採用。authoring device の設定へ Web implementation の都合を漏らし、HEIF の storage efficiency や既存 workflow を損なう。

### raw HEIC を repository に commit

不採用。build support が native dependency に左右され、metadata privacy と Git history も悪化する。

### 全画像を Cloudflare Images へ直接 upload

高 volume では有力だが、外部 mutation / plan / cost を日常 publishing の baseline requirement にするため default にはしない。

## Consequences

- deterministic media ingest tool / container が必要。
- raw source と published asset の identity を分離できる。
- typical article route は build-time optimized image だけを配信できる。
- media validation を CI に追加する必要がある。

## Evidence

- https://support.apple.com/ja-jp/116944
- https://docs.astro.build/en/guides/images/
- https://sharp.pixelplumbing.com/install/
- https://developers.cloudflare.com/images/get-started/limits/
