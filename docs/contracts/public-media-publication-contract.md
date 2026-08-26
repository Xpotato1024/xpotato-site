---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - public media object identity
  - R2 object key policy
  - approved media publication transaction
---

# Public Media Publication Contract

## Principle

content mediaはsemantic asset identity、physical object identity、publication rightsを分離する。

- MDX: semantic asset ID
- Git Media Registry: ContentId + asset ID -> immutable object + provenance + rights
- public R2: normalized delivery bytes
- protected recovery copy: exact published bytesのrecovery plane

same public object keyへdifferent bytesを上書きしない。

## Media object identity

normalized public Web master exact bytesをSHA-256で識別する。

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

logical key:

```text
media/v1/objects/sha256/<first-two>/<sha256>.<ext>
```

requirements:

- exact bytes identityをkeyへ含める
- same bytes -> same key
- changed bytes -> new key
- article slug/title/ContentIdをphysical object identityへ要求しない

## Why content-addressed keys

- destructive overwriteを構造的に避ける
- Git rollbackでold registry -> old objectを参照可能
- identical normalized bytes dedupe
- immutable cache
- candidate時点でplanned keyを計算可能

## Semantic asset identity

articleはobject hashを直接参照しない。

```text
ContentId: 5e1f2aa4-7b66-4c2e-8f0b-2dd6597424c1
assetId: nas-memory-slot
```

assetIdはContentId内scopeのstable semantic identity。

same semantic subjectの写真差替えではassetId維持可。Git revisionごとのMedia Registryがcurrent objectへbindする。

## CandidateMediaObject

human approval前はpublic R2 uploadしない。

```ts
interface CandidateMediaObject {
  assetId: string;
  localArtifactSha256: string;
  plannedObject: PublicMediaObject;
  provenanceRef: string;
  rightsRef: string;
}
```

rightsRefは`media-publication-rights-contract.md`へ解決する。

## Rights gate

public media publicationの必要条件:

- rights record exists
- publicationAuthorized=true
- basis != unknown
- attribution/license requirements structurally complete
- candidate hashがrightsRefをbind

R2 publisher自身がlegal/right basisを推測しない。

## Publication timing

public R2 mutationはhuman approval後。

```text
candidate
 -> preview
 -> human approval
 -> rights revalidation
 -> public R2 media publication
 -> recovery protection
 -> repository export
```

previewはlocal candidate media adapterを使う。

## MediaPublicationRequest

```ts
interface MediaPublicationRequest {
  schemaVersion: 1;
  jobId: string;
  candidateSha256: string;
  approvalRecordSha256: string;
  objects: CandidateMediaObject[];
  publicUploadAuthorized: true;
}
```

AI/Skillは`publicUploadAuthorized`を自己生成できない。

approval laneまたはexplicit migration/operator policyからのみ成立する。

## Upload behavior

各object:

1. candidate/approval/rights binding再検証
2. planned content-addressed key再計算
3. R2 same key存在確認
4. absent -> exact candidate bytes upload
5. present -> expected identityと矛盾しないことを確認してreuse
6. size/content type/availabilityをpost-upload verify
7. manifestへ記録

key identity mismatchはfail closed。overwriteで直さない。

## Response headers

content-addressed public masterはlong immutable cache requirementを持つ。

```text
Cache-Control: public, max-age=31536000, immutable
```

exact provider/header applicationはdeployment/infra owner。

## MediaPublicationManifest

```ts
interface MediaPublicationManifest {
  schemaVersion: 1;
  jobId: string;
  candidateSha256: string;
  approvalRecordSha256: string;
  objects: Array<{
    assetId: string;
    sha256: string;
    objectKey: string;
    rightsRef: string;
    action: "uploaded" | "reused";
    verifiedSizeBytes: number;
    verifiedAt: string;
  }>;
  completedAt: string;
  manifestSha256: string;
}
```

media 0件ではempty successful manifest可。

このmanifestはrepository export permissionではない。次に`published-media-protection-contract.md`のMediaProtectionReceiptを成立させる必要がある。

## Failure semantics

partial upload failureでもapproved candidateをmutateしない。

stateは`HUMAN_APPROVED`に留まりsame candidate/approvalでidempotent retry。

public upload成功後・protection未完了ならstateは`MEDIA_PUBLISHED`。Git exportしない。

## Orphan objects

never-exported uploaded objectはorphan候補。

GC前に:

- current Media Registries
- policyでretained Git tags/releases
- active publication manifests
- protection receipts/status
- grace period

を確認する。

normal Article Jobはdelete/GCしない。

## Previously published objects

old Git revision/rollbackに必要なobjectを自動削除しない。

retired published object deletionはseparate privileged archival/GC policy。

## Raw media

private HEIC/original/AI raw outputをpublic media namespaceへ置かない。

## Protection and recovery

publication-time protection hard gate:

- `published-media-protection-contract.md`

missing/corrupt objectのrestore semantics:

- `media-recovery-contract.md`

public R2 objectを唯一のrecovery authorityにしない。

## Infrastructure boundary

site owns:

- object identity/key contract
- rights/provenance binding
- publication manifest
- protection/recovery requirement

`Xpotato-Server` owns:

- R2 bucket/provider resource
- credentials
- cache/provider settings
- protection/backup/restore implementation
