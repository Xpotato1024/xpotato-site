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

static-first siteの単純性を保ちながら、HTML / codeとlarge content mediaをそれぞれ適切なdelivery pathへ分離する。

## Delivery path

```text
Git / Astro
  -> HTML + hashed JS/CSS + small site assets
  -> Cloudflare Workers Static Assets

R2
  -> immutable content-media masters
  -> Cloudflare cache
  -> optional Images Transformations
  -> responsive image delivery
```

Article media bytesをAstro build artifactへ大量複製することをbaselineにしない。

## Artifact classes

### HTML

更新反映を優先し、長期immutable browser cacheにしない。ETag / revalidationを利用する。

### Fingerprinted site assets

Astro / Viteがhashを付けるJS / CSS / small design assetsはlong-lived `immutable`。

### R2 content media masters

article photo、screenshot、AI hero、gallery等のpublic masterはimmutable / versioned R2 keyを使用する。

R2 custom domainを通じCloudflare cacheへ乗せる。

### Responsive image variants

preferred:

- Cloudflare Images Transformationsでedge生成・cache

fallback:

- deterministic media pipelineで有限variantを事前生成しR2へ保存

いずれもGitへdelivery variantを保存しない。

### Stable control files

robots、sitemap等はrevalidation可能にする。

## Image URL generation

MDXはR2 URLを直接所有しない。

Media Asset Registryのlogical asset IDからbuild時にdelivery URL / `srcset`を生成する。

Cloudflare-specific transform URL formatはrenderer / delivery adapter内部へ閉じ込める。

## Cloudflare Images Transformations

R2 + Images Transformationsをpreferred delivery adapterとする理由:

- masterを1つだけ保存できる
- device width / output formatに合わせてtransformできる
- transformed variantをedge cacheできる
- Git / Astro build sizeを画像数から切り離せる

ただしexternal provider capability / pricingに依存するため、Article content contract自体は依存しない。

free quota超過やprovider停止時に記事が壊れないよう、original fallbackまたはpregenerated variant modeを実装可能にする。

## Compression

text responseはCloudflare edge compressionを利用する。

baseline:

- Brotli
- Gzip fallback

Zstandardはzone-level capabilityが有効な場合に検討する。

precompressed `.br` / `.gz`をGitへ大量commitしない。

## Resource hints

preload / preconnect / prefetchは実測に基づき限定する。

heroがLCP candidateならそのresolved delivery URLに対するearly fetchを検討する。

## Cache ownership

site repo:

- artifact class semantics
- logical media resolution
- `_headers`等application-local response policy
- delivery validation

`Xpotato-Server`:

- R2 bucket / custom domain
- zone-level Cache Rules
- Compression Rules
- Images Transformations enablement等provider state

同じexact provider configをsite repoへ複製しない。

## Validation

- HTML cache / ETag
- hashed JS/CSS immutable
- R2 master cacheability
- transformed/pregenerated responsive delivery
- expected width / format selection
- LCP image behavior
- broken R2 reference
- accidental direct raw-master delivery at excessive dimensions
- cross-origin latency / redirect chain

## Sources

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- R2 caching with custom domain: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- Cloudflare Images: https://developers.cloudflare.com/images/get-started/introduction/
- Images pricing: https://developers.cloudflare.com/images/pricing/
