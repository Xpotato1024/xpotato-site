---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - media ingest pipeline
  - article image ownership
  - responsive image delivery
---

# Media Pipeline

## Purpose

撮影・取得・生成したsource mediaを、Git repositoryを肥大化させずにprivacy-safe、traceable、responsive、cacheableなWeb mediaへ変換する。

通常の記事mediaはR2-firstとし、Gitはmedia metadata / registry / small site assetだけを所有する。

## Storage layers

```text
private raw source
      |
      | ingest / normalize
      v
public web master (R2, immutable)
      |
      | delivery transform
      v
responsive delivery variants
```

### 1. Private raw source

撮影・export・生成された元ファイル。

- HEIC / HEIF
- JPEG / PNG
- generated provider raw output
- original screenshot 等

raw sourceはGitへcommitしない。public asset bucketにも直接置かない。

camera sourceはGPS / EXIF等を含むためprivate archive / local workspace等で管理する。必要なretention / backupはpublic mediaとは別policyにする。

AI-generated raw outputはgeneration provenance検証のためArticle Job private artifactとして保持できる。

### 2. Public web master

公開配信用derivativeの正本。

**通常はR2へ保存する。**

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

master keyはimmutable / versionedとし、bytesが変わればnew keyを発行する。

### 3. Delivery variants

browserへ送るAVIF / WebP / fallback、responsive widthはauthorが手作業で保存しない。

preferred path:

```text
R2 master
  -> Cloudflare Images Transformations
  -> edge cached responsive variants
```

Cloudflare Images Transformationsを利用しない / 利用できない場合のfallback:

```text
R2 master
  -> deterministic variant generator
  -> R2 versioned variants
```

fallback variantもGitへcommitしない。

## Why not Git for article photos

画像binaryはGitの差分圧縮や履歴モデルと相性が悪く、置換しても旧bytesがhistoryに残る。

記事数と写真数が増えるほどclone、fetch、CI、backup、security scan等のrepository operationへ無関係なmedia bytesを運ぶことになる。

したがってGit-managed contentとR2-managed mediaを分離する。

Gitに残すもの:

- MDX
- taxonomy / media registry
- asset hash / dimensions / provenance reference
- small UI assets
- small textual SVG
- synthetic test fixtures

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
8. immutable R2 key allocation
9. upload
10. post-upload size / hash / availability verification
11. Media Asset Registry record generation

external uploadは明示permission boundaryを持つ。

## AI-generated media

AI raw outputはprivate Article Job artifactとしてhashを固定する。

可能な場合はembedded provenance signalを検査し、provider / model / request hash / raw hashをgeneration recordへ保存する。

公開masterへ変換後も`origin=ai_generated`とgeneration recordへのlineageを失わない。

AI heroはtechnical evidenceとして使用しない。

## Logical references in MDX

site-owned mediaのR2 URLをMDXへ直書きしない。

standard logical reference:

```md
![メモリスロット](media:nas-memory-slot)
```

rendererはMedia Asset Registryを使って:

- master identity
- width / height
- responsive URLs
- fallback URL

へ解決する。

storage / domain migrationをarticle rewriteへ波及させない。

## Cloudflare delivery

R2はcustom domainを経由してCloudflare cacheを利用する。

Images Transformationsが有効な場合、finite responsive width profileと`format=auto`等を利用する。

2026-08時点のCloudflare ImagesはR2等の外部storage imageのtransformに対応するが、pricing / free quotaは変更され得るためprovider exact valuesをarchitecture SoTに固定しない。

変換backendはdelivery adapterとして扱い、asset identityをCloudflare-specific URLへ結合しない。

## Loading policy

- LCP hero: lazy loadしない
- below-the-fold: lazy loadingを基本
- width / heightまたはaspect ratioを必須
- content-bearing imageはmeaningful alt
- generated heroはsynthetic media disclosure policyに従う

## R2 lifecycle

public masterは記事がactiveな間は保持する。

asset replacement後のretired masterは即時削除せず、Git revision / rollback windowと整合するretention policyを持つ。

raw private archiveとpublic R2 lifecycleを混同しない。

## Validation

- `.heic` / `.heif` article binaryがGitに新規追加されていない
-通常のarticle photo / screenshot / generated heroがGitに追加されていない
- registry assetがR2 objectへ解決できる
- recorded SHA / size / dimensionsが一致する
- camera derivativeにGPS / private EXIFが残っていない
- AI derivativeがgeneration provenance refを持つ
- published Blog heroがexactly one
- representative responsive URL / `srcset`が生成される
- broken / retired asset referenceがない

## Sources

- Apple HEIF / HEVC: https://support.apple.com/ja-jp/116944
- Astro remote images: https://docs.astro.build/en/guides/images/
- Cloudflare Images: https://developers.cloudflare.com/images/get-started/introduction/
- Cloudflare Images transformations: https://developers.cloudflare.com/images/optimization/transformations/overview/
- R2 custom-domain caching: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
