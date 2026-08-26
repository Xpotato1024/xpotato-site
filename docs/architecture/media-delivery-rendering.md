---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - logical media reference resolution
  - R2 responsive image rendering
  - build network independence for content media
---

# Media Delivery Rendering

## Goal

MDXをstorage providerから切り離し、R2-first mediaをbuild時のnetwork fetchなしでresponsive HTMLへ解決する。

## Authoring surface

通常画像:

```md
![NAS内部](media:nas-interior)
```

Figure:

```mdx
<Figure asset="nas-interior" alt="NAS内部" caption="メモリ交換前" />
```

`media:` / `asset`はcurrent content IDにscopedなsemantic asset ID。

## Build resolution

```text
MDX media:nas-interior
        |
        v
content ID + asset ID
        |
        v
Media Asset Registry
        |
        +-- object key
        +-- master width/height
        +-- master format
        +-- origin/provenance
        v
Media Delivery Profile
        |
        v
<picture> / <img> URLs
```

## No build-time master download

normal site buildはR2 master bytesをdownloadしてdimensionを再計算しない。

Media Registryがpublish時にverified width / height / size / hashを保持する。

availability / remote hash checkは別network validatorで実行できるが、HTML generation contractと分離する。

これにより:

- offline-ish reproducible build
- R2 outageでsource compilationまで失敗しない
- build latencyがarticle image数に比例しない
- image processing dependencyをAstro buildから分離

を得る。

## Markdown transformer

vNext siteはremark / MDX transformで`media:` schemeを検出する。

responsibility:

1. current content IDを取得
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

article authorはformat list / transform URL / pixel widthsを直接指定しない。

## Delivery profile

```ts
interface MediaDeliveryProfile {
  id: string;
  adapter: "cloudflare_images" | "prebuilt_r2_variants";
  widths: number[];
  formats: Array<"avif" | "webp" | "jpeg" | "png">;
  qualityProfileId: string;
}
```

exact widths / qualityはmachine-readable profile。

page usageごとにprofileを分けられる。

例:

- inline content
- hero
- gallery thumbnail
- social card

## Cloudflare Images adapter

preferred path:

```text
R2 immutable master
  -> deterministic transform URL builder
  -> Cloudflare edge transformation/cache
```

buildはprovider URL構文をadapterへ閉じ込める。

MDX / registryはCloudflare-specific transform queryを知らない。

`format=auto`等のprovider capabilityを使う場合も、HTML fallbackが存在すること。

## Prebuilt variant adapter

Images Transformationsを使わない場合:

```text
R2 master
  -> deterministic media variant stage
  -> R2 immutable variants
  -> variant manifest
```

Media Registry / delivery manifestから`srcset`を構築する。

Gitへvariant binaryを置かない。

## HTML requirements

content-bearing image:

- `alt` required
- width / heightまたはstable aspect ratio
- below-the-foldはlazy default
- decode policyはbrowser-friendly default

hero / LCP candidate:

- lazy禁止
- responsive sourceあり
- `fetchpriority=high`はpage template / measured policyから付与可能
- oversized originalを直接配信しない

## Social card

social cardはArticle Job / deterministic generatorが作るR2 media objectとして扱える。

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

## Security

registryから生成するURLだけをsite-owned mediaとして扱う。

article MDXが任意R2 object keyやtransform directiveを注入できないようにする。

SVG content mediaはactive content / script / external refsを考慮して別sanitization gateを通す。

## Validation

- all `media:` refs resolve
- no direct site-owned R2 URL in MDX
- dimensions recorded
- delivery profile exists
- generated `srcset` monotonic / unique widths
- hero priority policy valid
- content build performs no remote image download
- external availability validation can run separately
