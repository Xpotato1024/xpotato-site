---
status: proposed
owner: content
last_verified: 2026-08-25
canonical_for:
  - content model
  - URL and taxonomy semantics
  - legacy content boundary
---

# Content Architecture

## Content engine

Astro の current Content Layer / Content Collections を使用する。旧 `src/content/config.ts` 互換 API を target design としない。

implementation migration では current Astro major の推奨 loader / render API へ移行する。

## Collections

vNext の logical collections は次を基本とする。

- `blog`: 公開記事
- `notes`: 学習・技術ノート
- `projects`: 制作物 / project record
- `tools`: browser tool / utility
- `pages`: About 等の長期固定ページ

collection を増やすときは、URL、schema、navigation、ownership が既存 collection と実質的に異なることを示す。

## Common metadata

既存 field name を無意味に変更せず、migration cost を抑える。

共通候補:

- `title`
- `description`
- `pubDate`
- `updatedDate?`
- `tags`
- `draft`
- `canonical?`
- `ogImage?`

`canonical` を schema に置くなら runtime SEO component が必ず尊重する。使わない field を schema / docs に残さない。

## Taxonomy

category は free-form string とせず、1つの registry から schema、label、description、route、filter を導出する。

typo を fallback category へ暗黙変換しない。未知 category は build / validation error とする。

tags は自由度を許容するが、case / whitespace normalization と duplicate removal を validation する。

## URL ownership

canonical URL は route implementation と content identity から決定する。

- blog: `/blog/<slug>/`
- notes: `/notes/<slug>/`
- projects: `/projects/<slug>/`
- tools: `/tools/<slug>/`
- pages: root-level page route を基本とする

route 変更時は redirect を同一変更で設計する。

## Redirect classes

application path redirect と provider / zone-level legacy redirect を区別する。

### Application path redirect

同一 site 内の path rename 等。site repository が owner であり、Cloudflare Workers Static Assets の `_redirects` 等へ build artifact として反映できる。

### Legacy query / provider redirect

WordPress の `/?p=...` のような query-string identity、domain-level redirect、zone rule。Static Assets `_redirects` の path rule では十分でないため、Cloudflare provider configuration の owner である `Xpotato-Server` 側で適用する。

content frontmatter の `legacyPath` は historical identity の evidence として利用できるが、それだけで redirect が有効になったとみなさない。将来 schema を `legacyUrls` 等へ整理する場合も、redirect owner を明記する。

## MDX safety / maintainability

新規記事では raw legacy HTML wrapper を標準にしない。

- Markdown / MDX を優先する。
- embedded component は approved component API を使用する。
- article-specific interactive component は island boundary を明示する。
- generated / imported HTML を `set:html` する経路は legacy migration に限定する。

WordPress importer は active publishing workflow から隔離し、migration-only tool とする。

## Asset references

- source-controlled optimized image: repository asset pipeline
- passthrough small static file: `public/`
- heavyweight / downloadable asset: R2

R2 path は article / project identity と対応付け、同じ key の破壊的上書きを避ける。

## Content correctness

frontmatter validation だけでなく、CI で少なくとも次を検査する。

- duplicate slug / conflicting route
- invalid category
- broken local asset reference
- required image alt / dimensions where applicable
- canonical URL format
- legacy redirect registry conflict
- draft exclusion
