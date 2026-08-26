---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - media ingest pipeline
  - public media placement boundary
  - responsive image delivery
---

# Media Pipeline

## Purpose

撮影・取得・生成したmediaを、Git repositoryをmedia binary archive化せず、privacy-safe、traceable、responsive、cacheableなWeb mediaへ変換する。

2026-08-26 current inventoryでは、既にProject overview PNG、WordPress移行画像、site photographic hero等のraster mediaがGitへ約4.54 MB存在する。小規模な現状でもmedia数に比例するGit growthが始まっているため、vNextはR2-firstをstandardとする。

## Storage layers

```text
private raw source
      |
      | deterministic ingest / normalize
      v
private candidate web master
      |
      | deterministic responsive variant generation
      v
private candidate delivery set
      |
      | human approval / migration authorization
      v
public R2 immutable master + variants
      |
      | protected recovery copy
      v
protected media receipt
      |
      v
CDN/cache delivery
```

通常Article Jobではpublic uploadはhuman approval後。legacy bulk migrationはoperator-reviewed migration publication plan後。

## Media placement boundary

R2-firstは「大容量だけ」ではなく、**photographic/raster media class**の標準配置である。

R2-first:

- camera photo
- screenshot
- raster Blog/Notes/Project/Tool visual
- photographic/raster site hero/background
- AI-generated raster visual
- gallery media
- downloadable binary that is not source-code-sized textual asset

Git-bundled candidate:

- small deterministic SVG
- logo / favicon / icon
- tiny design-system texture
- small textual graphic whose source is meaningfully reviewable as text
- synthetic test fixture

したがって`hero-workshop-stage.jpg`のようにsite chrome用途でもphotographic rasterはR2へ移す。

用途がsite chromeかcontentかではなく、binary growth / reviewability / rebuildabilityで判断する。

## 1. Private raw source

撮影・export・生成された元ファイル。

- HEIC / HEIF
- JPEG / PNG
- generated provider raw output
- original screenshot

raw sourceはGitへcommitしない。public asset bucketにも直接置かない。

camera sourceはGPS / EXIF等を含むためprivate archive / local workspace等で管理する。

AI-generated raw outputはgeneration provenance検証のためArticle Job private artifactとして保持できる。

private raw retentionはpublic deliveryとは別policy。

## 2. Private candidate Web master

public配信用derivative候補のnormalized bytes。

camera / screenshot:

- auto orientation
- sRGB
- private metadata strip
- excessive dimensionsの制限
- semantic asset identity

AI-generated:

- dimensions / color normalization
- crop / safe-area normalization
- raw generation recordへのlineage

この段階ではGitにもpublic R2にもpublishしない。

exact ingest contractは`../contracts/media-ingest-contract.md`。

## 3. Deterministic responsive variant set

Cloudflare-specific transformationをbaseline requirementにしない。

normalized masterからversioned Media Delivery Profileに従い、有限variantをprivate workspaceで生成する。

conceptual:

```text
master
  + delivery profile
      |
      +-- width 480  -> AVIF / WebP / fallback
      +-- width 960  -> AVIF / WebP / fallback
      +-- width 1440 -> AVIF / WebP / fallback
      +-- ...
      v
variant manifest
```

exact width / quality / formatはmachine-readable profileで管理する。

authorはvariantを手作業で作らない。

variant manifestは:

- master SHA
- profile SHA
- each output SHA / format / width / height / size

をbindする。

## 4. Public R2 media set

approval / migration authorization後、masterとrequired variantsをcontent-addressed immutable keyへpublishする。

same bytes -> same object key。

changed bytes -> new key。

same keyへdifferent bytes overwriteは禁止。

Media Registryはsemantic asset IDからmaster + delivery variant manifestへ解決する。

exact publication contractは`../contracts/public-media-publication-contract.md`。

## 5. Protected recovery copy

Gitへmedia bytesを残さないため、public delivery R2だけを唯一のrecovery copyにしない。

Article Jobでは:

```text
MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

をrequired pathとする。

protection implementation / retention / credentialsは`Xpotato-Server`側SoT、site側はobject identity + protection receipt requirementを所有する。

exact contractは`../contracts/published-media-protection-contract.md`。

## 6. Delivery adapter

### Baseline: prebuilt R2 variants

```text
R2 immutable master + variants
 -> assets custom domain / CDN cache
 -> browser <picture>/<srcset>
```

Cloudflare固有の画像変換featureを必要としない。

### Optional: Cloudflare Images Transformations

Cloudflare Imagesを有効にする場合もoptional delivery adapterとする。

利用時:

```text
R2 immutable master
 -> Cloudflare transform URL
 -> edge variant/cache
```

ただし:

- MDX semantic refは変えない
- master identityは変えない
- prebuilt baselineを削除 prerequisiteにしない
- provider feature停止で記事が壊れない

optional adapter導入はperformance/cost evidenceを要求する。

## Why not Git for photographic/raster media

binary imageはGit historyで削除・置換しても旧bytesが残る。

記事数 / project screenshot / site imageryが増えるほどclone、fetch、CI、backup、security scanへ無関係なmedia bytesを運ぶことになる。

current inventoryでもknown raster/photo subsetは約4.54 MBで、xpotato-site overview PNG単体が約1.22 MB、site hero JPEGが約0.76 MB存在する。

したがってGit-managed content/sourceとR2-managed photographic/raster mediaを分離する。

## iPhone / HEIC

Apple High Efficiency撮影のHEIC / HEIFをfirst-class inputとして許可する。

authorへJPEG撮影を要求しない。

HEIC decode capabilityはAstro buildのoptional native dependencyへ暗黙依存させず、`packages/media-ingest`の専用tool / containerで固定する。

Ingest flow:

1. input probe / type detection
2. HEIC / HEIF decode where needed
3. auto orientation
4. sRGB conversion
5. privacy metadata strip for camera media
6. master profile resize / encode
7. SHA-256
8. private candidate output + ingest manifest
9. deterministic responsive variant generation

**media-ingest / variant generationはpublic R2 uploadしない。**

後段のArticle Job / migration workflowが:

10. rights/provenance gate
11. human approval / migration authorization
12. immutable master/variant object key derivation
13. R2 upload/reuse + post-upload verification
14. protected-copy verification
15. Media Registry / provenance export

を担当する。

## AI-generated media

AI raw outputはprivate Article Job artifactとしてhashを固定する。

可能ならembedded provenance signalを検査し、provider / model / request hash / raw hashをgeneration recordへ保存する。

公開masterへ変換後も`origin=ai_generated`とgeneration recordへのlineageを失わない。

AI heroはtechnical evidenceとして使用しない。

## Media rights

Web上でdiscoveryできることと再配布できることを同一視しない。

public R2 publicationには`../contracts/media-publication-rights-contract.md`のpublication-eligible rights basisが必要。

rights unknownのexternal imageは:

- source link
- self-created diagram
- user-authorized source media
- AI conceptual illustration

等へ置き換える。

## Logical references in MDX

site-owned mediaのR2 URLをMDXへ直書きしない。

```md
![メモリスロット](media:nas-memory-slot)
```

rendererはMedia Asset Registryを使ってmaster identity / dimensions / delivery variantへ解決する。

storage/domain migrationをarticle rewriteへ波及させない。

current legacy `r2:/...` literalはmigration sourceとしてのみ扱い、vNext authoring APIにしない。

## Cloudflare delivery

R2 custom domain / CDNはdelivery implementationでありmedia identityではない。

baseline artifactはstandard immutable objectsなので、Cloudflare Imagesなしでも配信可能。

R2/S3-compatible object storageや別CDNへ移行しても:

- semantic asset ID
- master/variant hash
- responsive profile
- MDX

を維持できるようにする。

## Loading policy

- LCP hero: lazy loadしない
- below-the-fold: lazy loading基本
- width / heightまたはaspect ratio必須
- content-bearing imageはmeaningful alt
- generated heroはsynthetic-media policyに従う

## R2 lifecycle

public master / variantはpublished Git revisionが参照する間は保持する。

asset replacement後のretired objectは即時削除せず、Git rollback / retention policyと整合させる。

raw private archive / public R2 / protected-copy lifecycleを混同しない。

## Validation

Network-free Git/CI:

- `.heic` / `.heif`禁止
- photographic/raster content/project/site hero binaryのnew Git addition禁止
- approved Git-bundled asset classだけ許可
- direct site-owned R2 URL / `r2:/` authoring literal禁止
- logical media ref resolves registry
- rights/provenance fields present
- variant manifest complete / profile hash current

Media ingest:

- camera derivativeにGPS/private EXIFなし
- master/variant output hash/dimensions/profile一致

External integration:

- registry master/variantsがpublic R2でexpected identity
- protection receiptがpublication manifestへbind
- representative `srcset` valid
- optional Cloudflare Images adapter failureでもbaseline asset URLがvalid

## Sources

- Apple HEIF / HEVC: https://support.apple.com/ja-jp/116944
- Cloudflare R2 API: https://developers.cloudflare.com/r2/api/
- R2 custom-domain caching: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- Cloudflare Images transformations (optional): https://developers.cloudflare.com/images/optimization/transformations/overview/
