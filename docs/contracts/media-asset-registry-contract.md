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

MDX / frontmatterからR2 object keyとmedia provenanceを分離し、content identityに対してsemantic media roleを解決する。

通常content media binaryはGitへ保存しない。Gitにはこのregistryだけを保存する。

## Registry unit

1 content IDにつき1 registry fileを基本とする。

```ts
interface ContentMediaRegistry {
  schemaVersion: 1;
  contentId: string;
  assets: MediaAssetRecord[];
}
```

candidate location:

```text
apps/site/src/content-registry/media/<collection>/<content-id>.json
```

巨大な単一registry fileを作らず、Article Job export間のmerge conflictを抑える。

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
  visualAuditRef?: string;
  status: "active" | "retired";
}
```

## Asset ID

`assetId`はcurrent content内でstableなsemantic ID。

例:

```text
nas-memory-slot
before-upgrade
after-upgrade
architecture-overview
```

R2 path / SHAをasset IDにしない。

bytes差替え時もsemantic meaningが同じならasset IDを維持できる。Git revisionごとのregistryがその時点のimmutable objectへbindする。

## R2 object

`objectKey`は`public-media-publication-contract.md`に従うcontent-addressed immutable key。

bucket ID / account ID / public domainをrecordへ保存しない。

rendererはsite media delivery profileからpublic URLへ解決する。

## Hero invariant

published Blogはexactly one active `role=hero`を持つ。

heroは`defaultAlt`または`decorative=true`を明示する。

複数active heroはvalidation error。

## Social card invariant

published Blogはexactly one active `role=social_card`を持つことをtargetとする。

social cardはdeterministic derivationで生成でき、frontmatter title / description / selected hero / style profileにbindする。

stale derivationはpublication validation error。

## Inline reference

MDX:

```md
![メモリスロット](media:nas-memory-slot)
```

inline altはMDX側がcontext-specific source of truth。

registry `defaultAlt`をinline altの暗黙代替にしない。

## Provenance

- camera / screenshot -> MediaIngestResult / source record
- AI generated -> GeneratedImageRecord
- deterministic cover / social card -> derivation manifest
- diagram -> source / generator record

AI-generated originはvisual audit required。

## No content-photo local storage mode

camera / screenshot / AI hero / gallery mediaについて`storage=local` escape hatchを設けない。

small favicon / logo / UI icon / source-controlled SVGはcontent media registryではなくsite bundled assetとして管理する。

これにより「便利だから写真だけGitへ置く」driftを防ぐ。

## Status

`retired`はnew MDX reference禁止。

過去Git revisionが参照するR2 objectの自動削除を意味しない。

## Validation

- contentId / assetId pair unique
- published Blog hero exactly one
- published Blog social card exactly one
- object key conforms to content-addressed policy
- recorded SHA / size / dimensions valid
- inline `media:` ref resolves active asset
- AI asset has visualAuditRef
- hero alt/decorative policy satisfied
- no direct provider account/bucket ID
