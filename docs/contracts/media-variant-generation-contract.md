---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - responsive media variant generation
  - media delivery profile artifact contract
---

# Media Variant Generation Contract

## Purpose

private normalized Web masterから、provider-independentなresponsive delivery variant setをdeterministicに生成する。

HEIC decode / orientation / privacy normalizationを行う`media-ingest-contract.md`とは責務を分離する。

## Input

```ts
interface MediaVariantGenerationRequest {
  schemaVersion: 1;
  contentId: ContentId;
  assetId: string;

  master: {
    privateRelativePath: string;
    sha256: string;
    format: "jpeg" | "png" | "webp" | "svg";
    width: number;
    height: number;
    sizeBytes: number;
  };

  usage: "inline" | "hero" | "gallery" | "overview" | "social";
  profileId: string;
}
```

requestはpublic R2 objectを入力にしない。private candidate masterを使用する。

## Delivery profile

```ts
interface MediaVariantProfile {
  schemaVersion: 1;
  id: string;
  usage: "inline" | "hero" | "gallery" | "overview" | "social";

  widths: number[];

  formats: Array<{
    format: "avif" | "webp" | "jpeg" | "png";
    qualityProfileId?: string;
    lossless?: boolean;
  }>;

  preserveOriginalWhenSmaller: boolean;
  upscale: false;
}
```

rules:

- widths positive / unique / ascending
- source幅を超えるupscaleをしない
- originalより大きいvariantを無条件採用しない
- profile valueはarticle/frontmatterへ持たせない
- quality profileもversion-controlled SoT

## Fixed versus responsive media

次はresponsive variant generationをskipできる:

- sanitized vector SVG
- fixed social card
- downloadable binary

skipもimplicitにせず`MediaVariantManifest.status="not_required"`として表現する。

## Output

```ts
interface MediaVariantRecord {
  sha256: string;
  privateRelativePath: string;
  format: "avif" | "webp" | "jpeg" | "png";
  width: number;
  height: number;
  sizeBytes: number;
  contentType: string;
}

interface MediaVariantManifest {
  schemaVersion: 1;
  contentId: ContentId;
  assetId: string;
  masterSha256: string;
  profileId: string;
  profileSha256: string;
  toolchainId: string;
  toolchainSha256: string;
  status: "generated" | "not_required";
  variants: MediaVariantRecord[];
  warnings: string[];
  manifestSha256: string;
}
```

## Determinism

same:

- master bytes
- profile
- encoder/toolchain version

からsame output bytesをtargetとする。

encoder/library upgradeでoutput bytesが変わる場合はtoolchain fingerprintを変え、新しいvariant setとして扱う。

old variant objectをsame keyへoverwriteしない。

## Candidate identity

responsive media assetではcandidate hashに少なくとも:

- master SHA
- variant manifest SHA
- profile SHA

を含める。

human approval後にvariant profileを変更した場合、approvalはstale。

## Public object planning

variant generation段階ではR2 uploadしない。

各output SHAから`public-media-publication-contract.md`のcontent-addressed keyを事前計算できる。

```text
private variant bytes
 -> planned immutable R2 object
```

に留める。

## Baseline provider independence

outputはstandard image filesであり、Cloudflare Images Transformationsを必要としない。

public deliveryは:

```text
R2/S3-compatible object storage
 + normal CDN/static object delivery
```

で成立する。

Cloudflare Images等をoptional adapterとして使う場合もこのmanifestをbaselineとして維持する。

## Security/privacy

variant stageは:

- external network不要
- credential不要
- public upload禁止
- masterに存在しないprivate metadataを新規付与しない

ことをtargetとする。

camera privacy strippingはingest段階で完了済みであることをvalidateする。

## Validation

- request master SHA matches bytes
- profile ID/hash valid
- no upscale
- width ordering unique
- expected format set complete
- dimensions/aspect ratio valid
- output hash/size recorded
- repeated fixture generation stable under pinned toolchain
- generated files remain outside Git working tree
- no public R2 mutation

## Animated inline（追加候補）

`animation-inline-v1` は lossless animated WebP を生成します。master / variants の各 object は実 bytes に一致する `animation`（frameCount / delaysMs / loop）を持ち、canonical と同じ縮小処理を行った全表示区間の RGBA と時刻・loop の同値検査を通ります。`delivery.mode="animated"` は独立した静止 asset への `posterAssetId` を持ちます。poster を含む全 object が通常の保存・保護・復旧集合へ入ります。[専用手順](../operations/animated-article-media.md)を参照してください。

`animation-inline-v1` の `preserveOriginalWhenSmaller` は、縮小後の実 bytes が public master より増える候補を除外し、同じ bytes の full-width public master を variant に含めます。従って配信する幅集合は固定幅候補の部分集合と full-width の和で、全 variant の容量は master 以下です。選ばれた集合を manifest / registry / A/B/C 保存で一致させ、CI はこの容量条件と全表示区間の同値を検査します。
