---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - content model
  - URL and taxonomy semantics
  - MDX content modules
  - legacy content boundary
---

# Content Architecture

## Product relationship

content model は `docs/product/product-context.md` の authoring goal を満たすために設計する。

通常の記事追加で author が SEO boilerplate、responsive image variant、archive route を個別管理しないことを優先する。

## Content engine

Astro の current Content Layer / Content Collections を使用する。旧 `src/content/config.ts` 互換 API を target design としない。

implementation migration では current Astro major の推奨 loader / render API へ移行する。

## Collections

vNext の logical collections は次を基本とする。

- `blog`: 公開技術記事
- `notes`: 学習・技術ノート
- `projects`: 制作物 / project record
- `tools`: browser tool / utility
- `pages`: About 等の長期固定ページ

collection を増やすときは URL、schema、navigation、ownership が既存 collection と実質的に異なることを示す。

## Authoring metadata

通常の Blog article は content 自体に必要な metadata を中心にする。

基本候補:

- `title`
- `description`
- `pubDate`
- `updatedDate?`
- `category`
- `tags`
- `draft`
- `heroImage?`

slug / canonical route / collection type / sitemap entry / structured data type 等は system から導出する。

### SEO override

通常記事へ `canonical`、`ogTitle`、`ogType` 等を毎回書かせない。

例外的に override が必要なら `seo` namespace 等へ閉じる。

候補:

```yaml
seo:
  canonicalOverride: https://example.com/original/
  noindex: true
  titleOverride: optional title
```

exact schema は implementation 時に定義する。override を schema に持つ場合、runtime が必ず尊重し validator が用途を検査する。

## Taxonomy model

### Category

category は記事の primary broad topic とする。

- 1記事 1 category を基本とする。
- free-form string にしない。
- stable ASCII kebab-case ID と日本語 label / description を registry で管理する。
- schema、archive route、display label は同じ registry から導出する。
- unknown category は build error。

### Tag

tag は横断的な technology / concept / theme とする。

free-form input をそのまま route にしない。

registry candidate:

```text
id
label
description?
aliases[]
archive: true | false
indexable: true | false
```

- `id` は stable identity。
- `label` は表示名なので将来変更可能。
- `aliases` は legacy / spelling normalization 用。
- `archive=false` の tag は related-content signal 等に使えても archive route を作らない。
- `indexable=false` の archive は reader navigation 用に存在できるが sitemap / search index target にしない。

新しい tag は記事 frontmatter に typo で偶発生成せず registry へ明示追加する。

## Archive routes

最低限次を static generation する。

- `/blog/`: 全記事の新着順
- `/blog/category/<category>/`: category archive
- `/blog/tag/<tag>/`: `archive=true` の tag archive
- `/blog/archive/<yyyy>/`: year archive

monthly archive は content volume が必要性を示すまで作らない。

archive の UI で client-side filter を追加しても、canonical archive identity は static route を正とする。

indexability は `seo-discovery-policy.md` と taxonomy registry から決める。

## MDX-first body

通常要素は Markdown を使う。

- heading
- paragraph
- list
- code block
- table
- blockquote
- inline / block image
- link

HTML を書かないと表現できないことを前提にしない。

## Content design modules

Markdown だけでは表現しにくい content を typed Astro module として提供する。

初期候補:

- `Figure`: caption / credit / semantic width
- `Gallery` / `MediaGrid`: 複数画像
- `Callout`: note / warning / key point
- `Steps`: ordered procedure with rich body
- `Comparison`: option / before-after / trade-off
- `LinkCard`: related external/internal resource
- `Details`: expandable secondary detail
- `Demo`: interactive local feature boundary

module は static Astro component を default とする。local state が必要な `Demo` 等だけ React island 等を許可する。

### Freedom boundary

記事固有の表現が既存 module で不自然になる場合、新しい module / article-local component を追加できる。

ただし:

- arbitrary raw HTML を増やさない。
- article body に global CSS と競合する ad-hoc style を大量記述しない。
- design token を無視した raw color / spacing の乱立を避ける。
- reusable な表現は後から shared module へ昇格できる構造にする。

自由度は composition で確保し、保守不能な inline styling で確保しない。

## Media references

画像の authoring / ingest / responsive delivery は `media-pipeline.md` を正とする。

通常記事画像は `src/assets/content/<collection>/<slug>/` の normalized web master を使い、Markdown image syntax でも build-time optimization されることを target とする。

`public/` は通常記事写真の標準配置先にしない。

R2 は high-volume / large / downloadable media 用とする。

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

content metadata の legacy URL は historical identity / redirect requirement の evidence であり、それだけで redirect active とみなさない。

## Legacy content

新規記事では raw legacy HTML wrapper を標準にしない。

- Markdown / MDX を優先する。
- generated / imported HTML を `set:html` する経路は legacy migration に限定する。
- WordPress importer は active publishing workflow から隔離する。

## Content correctness

frontmatter validation だけでなく、CI で少なくとも次を検査する。

- duplicate slug / conflicting route
- invalid category / unknown tag
- taxonomy alias conflict
- archive route conflict
- broken local asset reference
- required image alt / dimensions where applicable
- SEO override format
- legacy redirect registry conflict
- draft exclusion
- new raw legacy HTML / raw HEIC publication path
