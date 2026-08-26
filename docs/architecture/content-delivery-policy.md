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

static-first siteの単純性を保ちながら、HTML/codeとlarge content mediaをそれぞれ適切なdelivery pathへ分離する。

Cloudflare固有のoptional featureがなくても高品質なresponsive deliveryを成立させる。

## Delivery path

```text
Git / Astro
  -> HTML + hashed JS/CSS + small site assets
  -> Cloudflare Workers Static Assets

private media pipeline
  -> immutable master + finite responsive variants
  -> R2
  -> custom domain / CDN cache
  -> responsive image delivery
```

Article media bytesをAstro build artifactへ大量複製しない。

## Artifact classes

### HTML

更新反映を優先し、長期immutable browser cacheにしない。ETag / revalidationを利用する。

### Fingerprinted site assets

Astro / Viteがhashを付けるJS / CSS / small design assetsはlong-lived `immutable`。

### R2 content media masters

article photo、screenshot、AI hero、gallery等のpublic masterはimmutable / versioned R2 keyを使用する。

### Prebuilt responsive variants

baselineではMedia Delivery Profileに従い、AVIF / WebP / fallbackの有限variantをdeterministicに生成してR2へ保存する。

- variant identity = exact bytes / profile lineage
- Gitへvariant binaryを保存しない
- browser `srcset`はMedia Registry / variant manifestから生成
- provider-side image transformationを必要としない

### Optional transformed variants

Cloudflare Images Transformations等を後付けadapterとして利用できる。

ただしoptional adapter停止時もprebuilt baselineで記事が正常に表示できること。

### Stable control files

robots、sitemap等はrevalidation可能にする。

## Image URL generation

MDXはR2 URLを直接所有しない。

Media Asset Registryのlogical asset IDからbuild時にdelivery URL / `srcset`を生成する。

provider-specific URL formatはdelivery adapter内部へ閉じ込める。

## Why prebuilt variants are baseline

- image outputsをGitでversioned profileへ束縛できる
- Cloudflare Images enablement / pricing / quotaに依存しない
- object storage + CDNだけで成立する
- R2/S3-compatible storageへ移行しやすい
- publication時にexact bytes/hashをapproval/protection対象へできる
- provider-side transform resultの将来変化をcontent provenanceから切り離せる

storage object数は増えるが、Git repositoryは増えず、content-addressed objectでdedupe / immutable cacheを維持できる。

## Cloudflare-specific optimization

Cloudflare固有最適化はbaselineを壊さない範囲で追加する。

候補:

- cache rules
- compression rules
- Images Transformations
- tiered caching

これらはGit/OpenTofu/APIで管理し、Dashboard-only操作をnormal prerequisiteにしない。

## Compression

Workers Static Assets / Cloudflare edgeの標準compressionをbaselineとする。

custom Compression Rulesは実測で必要な場合だけinfra desired stateへ追加する。

precompressed `.br` / `.gz`をGitへ大量commitしない。

## Resource hints

preload / preconnect / prefetchは実測に基づき限定する。

heroがLCP candidateならresolved baseline variantに対するearly fetchを検討する。

## Cache ownership

site repo:

- artifact class semantics
- logical media resolution
- `_headers`等application-local response policy
- delivery validation

`Xpotato-Server`:

- R2 bucket / custom domain
- Worker custom-domain binding
- zone-level Cache Rules
- Compression Rules
- optional Cloudflare Images/provider state

同じexact provider configをsite repoへ複製しない。

## Dashboard independence

normal content deliveryはCloudflare Dashboard設定を必要としない。

provider resource/configは`operations/cloudflare-control-plane-policy.md`に従いGit + OpenTofu/API/CLIで管理する。

## Validation

- HTML cache / ETag
- hashed JS/CSS immutable
- R2 master/variant cacheability
- expected width / format selection
- LCP image behavior
- broken R2 reference
- accidental raw-master delivery at excessive dimensions
- cross-origin latency / redirect chain
- optional provider optimization disabled時もbaseline rendering pass

## Sources

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- R2 caching with custom domain: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- Cloudflare Images transformations (optional): https://developers.cloudflare.com/images/optimization/transformations/overview/
