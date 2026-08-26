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

MDX/frontmatterからR2 object key、provenance、publication rightsを分離し、ContentIdに対してsemantic media roleを解決する。

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

  object: {
    sha256: string;
    objectKey: string;
    format: string;
    width?: number;
    height?: number;
    sizeBytes: number;
  };

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

R2 path / object hashをassetIdにしない。

same semantic roleのbytes差替えではassetIdを維持できる。Git revisionごとのregistryがそのrevisionで有効なimmutable R2 objectへbindする。

## R2 object

`objectKey`は`public-media-publication-contract.md`のcontent-addressed immutable key。

bucket/account/public domainをrecordへ保存しない。

rendererがmedia delivery profileからpublic URLへ解決する。

## Publication rights

全active public media assetは`rightsRef` required。

`rightsRef`は`media-publication-rights-contract.md`のMediaRightsRecordへ解決する。

required:

- publicationAuthorized=true
- basis != unknown
- required attribution metadata complete

provenanceがvalidでもrights recordがinvalidならpublished assetとして使用できない。

## Hero invariant

published Blogはexactly one active `role=hero`。

heroは:

- `defaultAlt`あり、または
- `decorative=true`

を明示する。

rights / visual audit policyも満たす必要がある。

## Social card invariant

published Blogはexactly one active `role=social_card`。

social cardはdeterministic derivation可能。

frontmatter title/category/selected visual/style profileにbindし、stale derivationは禁止。

social card自身もpublic R2 assetなのでrightsRefを持つ。通常はself-created/deterministic outputとしてsystem policyから生成可能。

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

過去Git revisionが参照するR2 objectの削除を意味しない。

## Validation

- ContentId / assetId pair unique
- ContentId resolves exactly one content
- published Blog hero exactly one
- published Blog social_card exactly one
- object key content-addressed policy valid
- SHA / size / dimensions valid
- inline `media:` ref resolves active asset
- provenanceRef resolves
- rightsRef resolves authorized non-unknown rights
- attribution-required asset has required metadata/render path
- AI asset has visualAuditRef
- screenshot has explicit rights/publication authorization
- hero alt/decorative policy satisfied
- no provider account/bucket ID
