---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - logical media reference resolution
  - responsive image rendering
  - build network independence for content media
---

# Media Delivery Rendering

## Goal

MDXをstorage/CDN providerから切り離し、R2-first mediaをbuild時のnetwork fetchなしでresponsive HTMLへ解決する。

## Authoring surface

通常画像:

```md
![NAS内部](media:nas-interior)
```

Figure:

```mdx
<Figure asset="nas-interior" alt="NAS内部" caption="メモリ交換前" />
```

`media:` / `asset`はcurrent ContentIdにscopedなsemantic asset ID。

## Build resolution

```text
MDX media:nas-interior
        |
        v
ContentId + asset ID
        |
        v
Media Asset Registry
        |
        +-- master identity
        +-- master width/height
        +-- variant manifest
        +-- origin/provenance
        v
Media Delivery Profile
        |
        v
<picture> / <img> URLs
```

## No build-time master download

normal site buildはR2 master bytesをdownloadしてdimension/variantを再計算しない。

Media Registry / variant manifestがpublish時にverified width / height / size / hashを保持する。

availability / remote hash checkは別network validatorで実行し、HTML generationと分離する。

これにより:

- reproducible build
- R2 outageでsource compilationまで失敗しない
- build latencyがarticle image数に比例しない
- image processing dependencyをAstro buildから分離

を得る。

## Markdown transformer

vNext siteはremark / MDX transformで`media:` schemeを検出する。

responsibility:

1. current ContentIdを取得
2. asset IDをvalidate
3. registry recordを解決
4. alt textを保持
5. internal `MediaPicture` representationへ変換

unknown / retired assetはbuild error。

HTTP(S) external imageは別policy。site-owned imageをexternal URLとして扱わない。

## MediaPicture

logical props:

```ts
interface MediaPictureProps {
  assetId: string;
  alt: string;
  usage: "inline" | "hero" | "gallery" | "overview" | "social";
  sizes?: string;
  priority?: "normal" | "high";
}
```

article authorはformat list / object key / pixel widthsを直接指定しない。

## Delivery profile

```ts
interface MediaDeliveryProfile {
  id: string;
  baselineAdapter: "prebuilt_r2_variants";
  widths: number[];
  formats: Array<"avif" | "webp" | "jpeg" | "png">;
  qualityProfileId: string;
  optionalAdapters?: Array<"cloudflare_images">;
}
```

exact widths / qualityはmachine-readable profile。

usageごとにprofileを分けられる。

- inline content
- hero
- gallery thumbnail
- overview
- social card

## Baseline prebuilt variant adapter

```text
private normalized master
  -> deterministic media variant stage
  -> immutable R2 master + variants
  -> variant manifest
  -> renderer srcset
```

variant manifestから`srcset`を構築する。

Gitへvariant binaryを置かない。

rendererはdelivery domain + object keyをsite config/registry adapterから組み立てるが、MDXはprovider URLを知らない。

## Optional Cloudflare Images adapter

Cloudflare Imagesを利用する場合:

```text
R2 immutable master
 -> deterministic transform URL builder
 -> edge transformation/cache
```

ただしoptional adapterでありbaselineではない。

requirements:

- MDX / Media Registry semantic identityは同一
- provider transform queryをarticleへ露出しない
- Cloudflare Images無効化時にprebuilt adapterへ戻せる
- provider transform-only URLを唯一のpublished referenceにしない

## HTML requirements

content-bearing image:

- `alt` required
- width / heightまたはstable aspect ratio
- below-the-foldはlazy default
- decode policyはbrowser-friendly default
- finite responsive source set

hero / LCP candidate:

- lazy禁止
- responsive sourceあり
- `fetchpriority=high`はpage template / measured policyから付与可能
- oversized originalを直接配信しない

## Social card

social cardはArticle Job / deterministic generatorが作るR2 media objectとして扱う。

article title等から生成したsocial cardは、title / style profile / hero object hashをderivation fingerprintへ含める。

frontmatter変更でfingerprintがstaleならvalidatorが再生成要求を出す。

## Small bundled assets

Gitに置いてよいsmall site asset:

- favicon
- logo
- small UI icon
- small textual SVG
- synthetic test fixture

これらはAstro/Vite asset pipelineを使用できる。

**content photo / screenshot / AI heroはbundled asset pathへ入れない。**

## Provider portability

Media RegistryはCloudflare account/zone IDを持たない。

storage/CDN移行で変更するのはdelivery adapter / origin configであり、content MDX・ContentId・assetId・variant profileをmass rewriteしない。

## Security

registryから生成するURLだけをsite-owned mediaとして扱う。

article MDXが任意R2 object keyやtransform directiveを注入できないようにする。

SVG content mediaはactive content / script / external refsを考慮して別sanitization gateを通す。

## Validation

- all `media:` refs resolve
- no direct site-owned R2 URL in MDX
- dimensions recorded
- baseline delivery profile exists
- variant manifest current
- generated `srcset` monotonic / unique widths
- hero priority policy valid
- content build performs no remote image download
- prebuilt baseline works without Cloudflare Images
- external availability validation can run separately
