---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - content media asset registry contract
  - hero / inline / social media resolution
---

# Media Asset Registry Contract

## Purpose

MDX/frontmatterからphysical object key、responsive variants、provenance、publication rightsを分離し、ContentIdに対してsemantic media roleを解決する。

normal content media binaryはGitへ保存しない。Gitにはregistry / provenance / rights referencesを保存する。

## Registry unit

1 ContentIdにつき1 registry fileを基本とする。

```ts
interface ContentMediaRegistry {
  schemaVersion: 1;
  contentId: ContentId;
  assets: MediaAssetRecord[];
}
```

candidate:

```text
apps/site/src/content-registry/media/<collection>/<content-id>.json
```

## Physical object reference

```ts
interface MediaObjectRef {
  sha256: string;
  objectKey: string;
  format: "jpeg" | "png" | "webp" | "avif" | "svg";
  width?: number;
  height?: number;
  sizeBytes: number;
}
```

`objectKey`はcontent-addressed immutable key。

bucket/account/public domainをrecordへ保存しない。

## Delivery set

```ts
interface MediaDeliverySet {
  mode: "fixed" | "responsive";
  profileId?: string;
  profileSha256?: string;
  variants: Array<
    MediaObjectRef & {
      width: number;
      height: number;
    }
  >;
}
```

responsive assetでは`profileId/profileSha256` required。

variantsはdeterministic prebuilt outputをbaselineとする。

Cloudflare Images等optional provider adapterのURLをregistry SoTにしない。

## MediaAssetRecord

```ts
interface MediaAssetRecord {
  assetId: string;

  role:
    | "hero"
    | "inline"
    | "gallery"
    | "overview"
    | "social_card"
    | "download";

  origin:
    | "camera"
    | "screenshot"
    | "diagram"
    | "ai_generated"
    | "deterministic_cover";

  master: MediaObjectRef;
  delivery: MediaDeliverySet;

  defaultAlt?: string;
  decorative?: boolean;

  provenanceRef: string;
  rightsRef: string;
  visualAuditRef?: string;

  status: "active" | "retired";
}
```

## Semantic asset identity

`assetId`はContentId内でstableなsemantic ID。

例:

```text
nas-memory-slot
before-upgrade
after-upgrade
architecture-overview
```

physical path / object hashをassetIdにしない。

same semantic roleのbytes差替えではassetIdを維持できる。Git revisionごとのregistryがそのrevisionで有効なimmutable master + variantsへbindする。

## Delivery requirements by role

### hero / inline / gallery / overview raster

baselineで`delivery.mode=responsive`。

required:

- finite width variants
- browser fallback format
- monotonic unique width set
- source size/dimension records

### social_card

fixed-size generated objectを基本とし`delivery.mode=fixed`でよい。

### download

original distributable artifactをfixed objectとして扱える。

### vector diagram

sanitized SVG等でresponsive raster variantsが不要な場合`fixed`を許可する。

## Public URL resolution

rendererは:

```text
MediaAssetRecord
 -> site delivery config
 -> public object URL / srcset
```

へ解決する。

registryへCloudflare account/zone/domainを持たない。

provider migration時にMediaAssetRecordを書き換える必要を最小化する。

## Publication rights

全active public media assetは`rightsRef` required。

`rightsRef`は`media-publication-rights-contract.md`のMediaRightsRecordへ解決する。

required:

- publicationAuthorized=true
- basis != unknown
- required attribution metadata complete

provenanceがvalidでもrights recordがinvalidならpublished assetとして使用できない。

rightsはsemantic asset/media set全体へbindする。同じmaster由来のdeterministic format/size variantsごとにrights recordを複製しない。

## Hero invariant

published Blogはexactly one active `role=hero`。

heroは:

- `defaultAlt`あり、または
- `decorative=true`

を明示する。

raster heroはbaseline responsive delivery set required。

rights / visual audit policyも満たす必要がある。

## Social card invariant

published Blogはexactly one active `role=social_card`。

social cardはdeterministic derivation可能。

frontmatter title/category/selected visual/style profileにbindし、stale derivationは禁止。

social card自身もpublic media assetなのでrightsRefを持つ。通常はself-created/deterministic outputとしてsystem policyから生成可能。

## Inline reference

```md
![メモリスロット](media:nas-memory-slot)
```

inline altはMDX context-specific SoT。

registry `defaultAlt`をinline altの無条件代替にしない。

## Provenance

- camera -> MediaIngestResult/source record
- screenshot -> MediaIngestResult + source/publication review
- AI generated -> GeneratedImageRecord
- deterministic cover/social card -> derivation manifest
- diagram -> source/generator record

AI-generated originはvisual audit required。

screenshotはuserがcaptureしただけで`self_created` rightsに自動昇格しない。

variant lineageはmaster SHA + delivery profile SHAへbindする。

## External discovered media

Web source discoveryで見つかったmedia URLをMedia Registryへ直接登録しない。

再配布rightsが確認できないexternal mediaは:

- citation/link only
- alternative self-created diagram
- authorized screenshot/media request
- generated conceptual visual

へ切り替える。

## No local content-photo storage mode

camera / screenshot / AI hero / gallery mediaについて`storage=local` escape hatchを設けない。

favicon/logo/UI icon/textual SVG等のsmall site assetはcontent media registryではなくbundled site asset。

## Status

`retired`はnew/current MDX reference禁止。

過去Git revisionが参照するpublic objectの削除を意味しない。

## Validation

- ContentId / assetId pair unique
- ContentId resolves exactly one content
- published Blog hero exactly one
- published Blog social_card exactly one
- master/variant object keys content-addressed policy valid
- SHA / size / dimensions valid
- responsive profile hash present/current
- responsive variant widths unique/monotonic
- required fallback exists
- inline `media:` ref resolves active asset
- provenanceRef resolves
- rightsRef resolves authorized non-unknown rights
- attribution-required asset has required metadata/render path
- AI asset has visualAuditRef
- screenshot has explicit rights/publication authorization
- hero alt/decorative policy satisfied
- no provider account/bucket/domain ID
