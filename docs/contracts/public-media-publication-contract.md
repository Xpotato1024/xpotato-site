---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - public media object identity
  - public media publication transaction
---

# Public Media Publication Contract

## Principle

Public delivery publication is a post-approval persistence stage that occurs **after required private canonical source persistence**。

Content media separates:

- semantic asset identity
- private canonical source identity
- public delivery object identity
- delivery variant set
- rights/provenance
- protected exact-byte recovery

Same public content-addressed key must never contain different bytes。

## Public object identity

```ts
interface PublicMediaObject {
  sha256: string;
  format: "jpeg" | "png" | "webp" | "avif" | "svg";
  width?: number;
  height?: number;
  sizeBytes: number;
  contentType: string;
  objectKey: string;
}
```

Logical key:

```text
media/v1/objects/sha256/<first-two>/<sha256>.<ext>
```

Rules:

- exact bytes determine key
- same bytes -> same key
- changed bytes -> new key
- no slug/title/provider resource identity in key semantics

## CandidateMediaSet

```ts
interface CandidatePhysicalMediaObject {
  purpose: "master" | "variant";
  localArtifactSha256: string;
  plannedObject: PublicMediaObject;
  variant?: {
    profileId: string;
    profileSha256: string;
    width: number;
  };
}

interface CandidateMediaSet {
  assetId: string;
  master: CandidatePhysicalMediaObject;
  variants: CandidatePhysicalMediaObject[];
  variantManifestSha256: string;
  provenanceRef: string;
  rightsRef: string;
}
```

Responsive raster media contains every required current profile variant; fixed/vector media may have `variants=[]`。

## Rights gate

Before public persistence:

- rightsRef resolves
- publicationAuthorized=true
- basis != unknown
- attribution/license requirements complete
- candidate/migration subject binds same rights record

Publisher does not infer legal basis itself。

## Publication authorization

Article Job and migration use different authorization records but the same exact media object contract。

```ts
type MediaPublicationAuthorization =
  | {
      kind: "article_job";
      jobId: string;
      candidateSha256: string;
      humanApprovalRecordSha256: string;
      canonicalSourceStorageReceiptSetSha256: string;
      articleJobPublicMediaPermission: true;
    }
  | {
      kind: "migration";
      migrationPlanSha256: string;
      operatorAuthorizationRecordSha256: string;
      canonicalSourceStorageReceiptSetSha256: string;
    };
```

Article Job rules:

- exact candidate is already `HUMAN_APPROVED`
- required source persistence has completed/verified and state is `MEDIA_SOURCE_STORED`
- if public media exists, `ArticleJobSpec.permissions.publicMediaUpload=true`
- lifecycle/provider sub-gates permit public object mutation

Migration rules:

- reviewed migration publication plan + explicit operator authorization
- required canonical source persistence completed before public publication
- Article Job state machine is not fabricated for migration, but source -> public -> protection order remains the same

AI/Skill cannot generate a valid authorization record by assertion。

## Publication timing

### Article Job

```text
candidate
 -> preview
 -> human approval
 -> canonical source storage/reuse
 -> MEDIA_SOURCE_STORED
 -> rights/permission/lifecycle revalidation
 -> public delivery publication/reuse
 -> MEDIA_PUBLISHED
 -> exact-byte protection
 -> MEDIA_PROTECTED
 -> cleanup-safe provenance/export
```

### Migration

```text
reviewed migration media candidate
 -> operator authorization
 -> canonical source storage/reuse
 -> public delivery publication/reuse
 -> exact-byte protection
 -> registry/provenance migration export
```

Preview never requires public R2 persistence。

## MediaPublicationRequest

```ts
interface MediaPublicationRequest {
  schemaVersion: 1;
  authorization: MediaPublicationAuthorization;
  mediaSets: CandidateMediaSet[];
}
```

The request does not contain a second free-form `publicUploadAuthorized` boolean。Authorization union is the authority and must be validated against current ArticleJobSpec/lifecycle or migration record。

## Required HTTP metadata

Every public content-addressed delivery object target:

```text
Content-Type: <correct media MIME>
Cache-Control: public, max-age=31536000, immutable
```

CORS is not required for ordinary `<img>/<picture>` delivery and is added only for a separate explicit browser-fetch/canvas requirement。

## Upload/reuse behavior

For each required master/variant:

1. validate authorization, source-storage receipt-set hash, rights/profile/object binding
2. recompute content-addressed key
3. probe same key if permitted
4. absent -> upload exact approved bytes + required metadata
5. present -> verify bytes identity/size/type/cache metadata and reuse
6. verify dimensions/availability
7. append deterministic manifest record

Never repair a key mismatch by overwrite。

If same-key object has wrong required metadata and normal publisher cannot safely repair without rewrite, fail and route to privileged repair workflow rather than mutating approved object identity semantics。

Any missing required responsive variant means media set is incomplete。

## MediaPublicationManifest

```ts
interface MediaPublicationManifest {
  schemaVersion: 1;
  authorization: MediaPublicationAuthorization;

  mediaSets: Array<{
    assetId: string;
    rightsRef: string;
    variantManifestSha256: string;
    objects: Array<{
      purpose: "master" | "variant";
      sha256: string;
      objectKey: string;
      format: string;
      width?: number;
      contentType: string;
      cacheControl: "public, max-age=31536000, immutable";
      action: "uploaded" | "reused";
      verifiedSizeBytes: number;
      verifiedAt: string;
    }>;
  }>;

  completedAt: string;
  manifestSha256: string;
}
```

Article Job manifest therefore carries the exact candidate/approval/source-storage receipt/permission binding through its authorization field。

Migration manifest carries the exact migration/operator/source-storage binding instead of pretending to have HumanApprovalRecord。

Media 0件:

- Article Job may use deterministic empty successful manifest after a valid `MEDIA_SOURCE_STORED`/not-required source stage
- no public write permission is required for a truly empty set
- implementation must not classify required media as empty merely because permission=false

## Article Job state / failure semantics

Public publication is legal only from `MEDIA_SOURCE_STORED` when public media exists。

Partial/complete failure:

- keep exact candidate, HumanApprovalRecord, CanonicalSourceStorageReceipt set immutable
- state remains **`MEDIA_SOURCE_STORED`**
- retry same request/authorization/content-addressed objects idempotently
- do not return to `HUMAN_APPROVED`
- do not change approved bytes/profile/rights to make retry succeed

Success:

- complete required set verified
- state -> `MEDIA_PUBLISHED`
- next required operation is exact-byte protection when public media exists
- Git export is still prohibited until protection + cleanup-safe recovery binding succeeds

## Optional provider transforms

Baseline publication artifact is prebuilt master/variants。Cloudflare Images or another transform adapter may accelerate delivery but:

- does not replace the manifest baseline object set
- does not become recovery identity
- does not change approval identity solely via transform cache state

## Orphans / GC

A failed later stage may leave unreferenced content-addressed public objects. Normal Article Job never deletes them。

Future GC is privileged/separate and must account for retained Git refs, publication/protection lineage, grace periods, and current open-decision policy。

## Raw/canonical media

Raw HEIC/original/provider output is not public media namespace content。

Privacy-normalized canonical source persistence is governed by `private-canonical-media-storage-contract.md` and must precede this public stage when required。

## Protection / recovery

After successful public persistence:

- `published-media-protection-contract.md`
- `media-recovery-contract.md`

Public delivery plane is not the only recovery authority。

## Infrastructure boundary

Site owns:

- content-addressed object semantics
- required HTTP metadata
- rights/profile/authorization/publication manifest semantics
- state/permission prerequisites

Infra owns after accepted provider activation:

- actual public object resource/custom domain
- scoped credentials
- provider cache/rules if explicitly adopted
- provider object operation implementation

This proposed contract does not authorize provider mutation while `architecture/design-status.md` / `architecture/infrastructure-handoff.md` remain blocked。
