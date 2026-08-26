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
      | human approval / migration authorization
      v
public web master (R2, immutable)
      |
      | protected recovery copy
      v
protected media receipt
      |
      | delivery transform
      v
responsive delivery variants
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

## 3. Public R2 Web master

approval / migration authorization後、candidate master bytesをcontent-addressed immutable keyへpublishする。

master keyはbytes identityから決まり、bytesが変わればnew key。

same keyへdifferent bytes overwriteは禁止。

exact publication contractは`../contracts/public-media-publication-contract.md`。

## 4. Protected recovery copy

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

## 5. Delivery variants

browserへ送るAVIF / WebP / fallback、responsive widthはauthorが手作業で保存しない。

preferred path:

```text
R2 master
  -> Cloudflare Images Transformations
  -> edge cached responsive variants
```

Images Transformationsを利用しない / 利用できない場合:

```text
R2 master
  -> deterministic variant generator
  -> R2 versioned variants
```

fallback variantもGitへcommitしない。

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
6. profile-based resize / encode
7. SHA-256
8. private candidate output + ingest manifest

**media-ingestはR2 uploadしない。**

後段のArticle Job / migration workflowが:

9. rights/provenance gate
10. human approval / migration authorization
11. immutable object key derivation
12. R2 upload/reuse + post-upload verification
13. protected-copy verification
14. Media Registry / provenance export

を担当する。

## AI-generated media

AI raw outputはprivate Article Job artifactとしてhashを固定する。

可能ならembedded provenance signalを検査し、provider / model / request hash / raw hashをgeneration recordへ保存する。

公開masterへ変換後も`origin=ai_generated`とgeneration recordへのlineageを失わない。

AI heroはtechnical evidenceとして使用しない。

## Media rights

Web上でdiscoveryできることと再配布できることを同一視しない。

public R2 publicationには`media-rights-contract.md`のpublication-eligible rights basisが必要。

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

rendererはMedia Asset Registryを使ってmaster identity / dimensions / delivery URLへ解決する。

storage/domain migrationをarticle rewriteへ波及させない。

current legacy `r2:/...` literalはmigration sourceとしてのみ扱い、vNext authoring APIにしない。

## Cloudflare delivery

R2はcustom domainを経由してCloudflare cacheを利用する。

Images Transformationsが有効な場合、finite responsive width profileとformat negotiationを利用する。

pricing / free quotaは変更され得るためprovider exact valuesをarchitecture SoTへ固定しない。

asset identityをCloudflare-specific delivery URLへ結合しない。

## Loading policy

- LCP hero: lazy loadしない
- below-the-fold: lazy loading基本
- width / heightまたはaspect ratio必須
- content-bearing imageはmeaningful alt
- generated heroはsynthetic-media policyに従う

## R2 lifecycle

public masterはpublished Git revisionが参照する間は保持する。

asset replacement後のretired masterは即時削除せず、Git rollback / retention policyと整合させる。

raw private archive / public R2 / protected-copy lifecycleを混同しない。

## Validation

Network-free Git/CI:

- `.heic` / `.heif`禁止
- photographic/raster content/project/site hero binaryのnew Git addition禁止
- approved Git-bundled asset classだけ許可
- direct site-owned R2 URL / `r2:/` authoring literal禁止
- logical media ref resolves registry
- rights/provenance fields present

Media ingest:

- camera derivativeにGPS/private EXIFなし
- output hash/dimensions/profile一致

External integration:

- registry objectがpublic R2でexpected identity
- protection receiptがpublication manifestへbind
- representative responsive URL / `srcset` valid

## Sources

- Apple HEIF / HEVC: https://support.apple.com/ja-jp/116944
- Astro remote images: https://docs.astro.build/en/guides/images/
- Cloudflare Images: https://developers.cloudflare.com/images/get-started/introduction/
- Cloudflare Images transformations: https://developers.cloudflare.com/images/optimization/transformations/overview/
- R2 custom-domain caching: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
