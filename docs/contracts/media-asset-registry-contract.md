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

MDX/frontmatterからprivate canonical source identity、public delivery object set、provenance、rightsを分離し、ContentIdに対してsemantic media roleを解決する。

media bytesはGitへ保存しない。Gitにはhash/profile/registry/provenance only。

## Registry unit

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

## Canonical source reference

private source-media provider locatorは保存しない。

```ts
interface CanonicalMediaSourceRef {
  storageClass: "private_canonical_media_v1";
  sha256: string;
  format: "webp" | "svg";
  width?: number;
  height?: number;
  sizeBytes: number;
  ingestProfileId: string;
  ingestProfileSha256: string;
}
```

これはfuture reprocessing identity。

raw HEIC/JPEG/PNG originalのidentity/locatorをMedia Registryのlong-term sourceにしない。

## Public physical object reference

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

`objectKey`はpublic content-addressed immutable key。

bucket/account/domainをrecordへ保存しない。

## Delivery set

```ts
interface MediaDeliverySet {
  mode: "fixed" | "responsive";
  profileId?: string;
  profileSha256?: string;
  master: MediaObjectRef;
  variants: Array<MediaObjectRef & { width: number; height: number }>;
}
```

responsive assetではprofile required。

baselineはdeterministic prebuilt outputs。Cloudflare Images URLをregistry SoTにしない。

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

  canonicalSource?: CanonicalMediaSourceRef;
  delivery: MediaDeliverySet;

  defaultAlt?: string;
  decorative?: boolean;

  provenanceRef: string;
  rightsRef: string;
  visualAuditRef?: string;

  status: "active" | "retired";
}
```

raster/source-managed content mediaでは`canonicalSource` required。

fixed small bundled site assetはこのregistry自体を使わない。

external distributable downloadなどcanonical re-encode sourceが意味を持たないclassでは`canonicalSource` optional。

## Semantic asset identity

`assetId`はContentId内のstable semantic ID。

same semantic subjectのbytes差替えではassetId維持可能。

Git revisionごとに:

```text
asset ID
 -> canonical source identity
 -> public delivery set
```

をbindする。

## Storage semantics

### Canonical source

- private source-media plane
- future reprocessing
- no public URL
- content-addressed
- raw originalではない

### Delivery

- public R2/CDN plane
- browser-facing master/variants
- content-addressed immutable objects

### Protection

protected exact bytesはMedia Registryへprovider locatorを複製しない。

Publication Provenance / MediaProtectionReceipt hashからrecovery chainを追跡する。

## Delivery requirements by role

hero / inline / gallery / overview raster:

- responsive mode
- finite widths
- browser fallback
- monotonic unique widths
- canonical source required

social_card:

- fixed 1200x630 profile candidate
- canonical source may be generated deterministic artifact

download:

- fixed distributable object possible

sanitized vector diagram:

- fixed SVG allowed
- canonical source can be same sanitized SVG identity

## Public URL resolution

```text
MediaAssetRecord.delivery object keys
 -> site delivery origin config
 -> public URL/srcset
```

provider migrationでMDX/semantic asset ID/canonical source semanticsを変更しない。

## Publication rights

all active public media has `rightsRef`。

required:

- publicationAuthorized=true
- basis != unknown
- required attribution complete

same semantic asset variantsへrights recordを重複しない。

## Hero/social invariants

published Blog:

- exactly one active hero
- exactly one active social_card

hero has `defaultAlt` or `decorative=true`。

raster hero has canonical source + responsive delivery。

AI asset has visual audit ref。

## Inline reference

```md
![メモリスロット](media:nas-memory-slot)
```

inline altはMDX context-specific SoT。

## Provenance

origin lineage examples:

- camera/screenshot -> MediaIngestResult
- AI -> GeneratedImageRecord + canonical ingest
- deterministic cover/social -> derivation manifest
- diagram -> sanitized source/generator

canonical source lineage = source artifact -> ingest profile -> canonical SHA。

delivery lineage = canonical SHA -> delivery profile -> public object SHA set。

## External discovered media

Web discovery resultを直接registryへ登録しない。

rights不明ならlink/self-created diagram/authorized source/generated conceptual visualへ置換する。

## Status/GC

`retired`はcurrent MDX reference禁止。

retiredはpublic/source/protected bytes deletionを意味しない。

GCはseparate privileged policy。

## Validation

- ContentId/assetId unique
- Blog hero/social cardinality
- required raster canonical source exists
- canonical source SHA/profile valid
- no private provider locator in canonical source ref
- delivery object keys content-addressed
- SHA/size/dimensions valid
- responsive profile current
- variant widths unique/monotonic/fallback exists
- `media:` refs resolve active asset
- provenance/rights/audit refs valid
- no provider account/bucket/domain ID
