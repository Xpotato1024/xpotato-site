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

content mediaはsemantic asset identity、physical object identity、delivery variant set、publication rightsを分離する。

- MDX: semantic asset ID
- Git Media Registry: ContentId + asset ID -> immutable master/variants + provenance + rights
- public R2: normalized master + delivery variants
- protected recovery copy: exact published bytesのrecovery plane

same public object keyへdifferent bytesを上書きしない。

## Media object identity

public exact bytesをSHA-256で識別する。

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
- Git rollbackでold registry -> old object setを参照可能
- identical bytes dedupe
- immutable cache
- candidate時点でplanned keyを計算可能

## Semantic asset identity

articleはobject hashを直接参照しない。

```text
ContentId: 5e1f2aa4-7b66-4c2e-8f0b-2dd6597424c1
assetId: nas-memory-slot
```

assetIdはContentId内scopeのstable semantic identity。

same semantic subjectの写真差替えではassetId維持可。Git revisionごとのMedia Registryがcurrent master/variant setへbindする。

## Candidate physical object

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
```

## CandidateMediaSet

human approval前はpublic R2 uploadしない。

```ts
interface CandidateMediaSet {
  assetId: string;
  master: CandidatePhysicalMediaObject;
  variants: CandidatePhysicalMediaObject[];
  variantManifestSha256: string;
  provenanceRef: string;
  rightsRef: string;
}
```

fixed mediaでは`variants=[]`を許可する。

responsive raster mediaではcurrent delivery profileが要求するvariant setを全て含む。

rightsRefは`media-publication-rights-contract.md`へ解決する。

## Rights gate

public media publicationの必要条件:

- rights record exists
- publicationAuthorized=true
- basis != unknown
- attribution/license requirements structurally complete
- candidate hashがrightsRefをbind

R2 publisher自身がlegal/right basisを推測しない。

variantsはsame authorized semantic assetのdeterministic derivationとしてrights lineageを継承する。

## Publication timing

public R2 mutationはhuman approval後。

```text
candidate
 -> preview
 -> human approval
 -> rights revalidation
 -> public R2 master/variants publication
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
  mediaSets: CandidateMediaSet[];
  publicUploadAuthorized: true;
}
```

AI/Skillは`publicUploadAuthorized`を自己生成できない。

approval laneまたはexplicit migration/operator policyからのみ成立する。

## Required object HTTP metadata

public content-addressed master/variantはupload時に少なくとも:

```text
Content-Type: <correct media MIME>
Cache-Control: public, max-age=31536000, immutable
```

相当のobject HTTP metadataを持つ。

理由:

- object URLはbytesが変わればkeyも変わる;
- browser/CDNへ長期cacheを安全に許可できる;
- provider-specific Cache Ruleをinitial prerequisiteにしない。

metadataはpublication verification identityの一部とし、同じobject bytesでもrequired HTTP metadataが欠ける場合はpublication completeとしない。

CORSはnormal image deliveryのobject metadata requirementにしない。browser fetch/canvas等のexplicit use caseが発生した場合だけbucket policyへ追加する。

## Upload behavior

各master/variant object:

1. candidate/approval/rights/profile binding再検証
2. planned content-addressed key再計算
3. R2 same key存在確認
4. absent -> exact candidate bytes + required HTTP metadata upload
5. present -> expected bytes identity + required HTTP metadataと矛盾しないことを確認してreuse
6. size/content type/cache metadata/dimensions/availabilityをpost-upload verify
7. manifestへ記録

key identity mismatchはfail closed。overwriteで直さない。

既存same-key objectでcache metadataだけが不正な場合もnormal publisherがdestructive overwriteで修正しない。privileged repair workflowへ送る。

responsive assetはrequired variantの1つでも欠ければpublication set completeにしない。

## MediaPublicationManifest

```ts
interface MediaPublicationManifest {
  schemaVersion: 1;
  jobId: string;
  candidateSha256: string;
  approvalRecordSha256: string;
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

media 0件ではempty successful manifest可。

このmanifestはrepository export permissionではない。次に`published-media-protection-contract.md`のMediaProtectionReceiptを成立させる必要がある。

## Baseline and optional provider transform

baseline publication artifactはprebuilt master/variants。

Cloudflare Images Transformations等のoptional adapterを有効にしても:

- MediaPublicationManifestのbaseline object setを失わない
- provider-generated transform URLを唯一のrecovery/publication identityにしない
- content approvalをprovider transform cache resultへbindしない

optional transformはdelivery acceleration layerとして扱う。

## Cache rule independence

initial vNextではmedia correctness/performanceのためのcustom Cloudflare Cache Ruleをrequiredにしない。

public custom domain + correct object `Cache-Control` metadata + Cloudflare default cache behaviorをbaselineとする。

将来Cache Ruleを追加する場合もobject identity/publication manifestを変更しない。

## Failure semantics

partial upload failureでもapproved candidateをmutateしない。

stateは`HUMAN_APPROVED`に留まりsame candidate/approvalでidempotent retry。

public required set upload成功後・protection未完了ならstateは`MEDIA_PUBLISHED`。Git exportしない。

## Orphan objects

never-exported uploaded objectはorphan候補。

GC前に:

- current Media Registries
- retained Git tags/releases policy
- active publication manifests
- protection receipts/status
- grace period

を確認する。

normal Article Jobはdelete/GCしない。

## Previously published objects

old Git revision/rollbackに必要なobjectを自動削除しない。

retired public object deletionはseparate privileged archival/GC policy。

initial protected-media copyはindefinite retentionなのでpublic GCとprotected GCを同一操作にしない。

## Raw media

private HEIC/original/AI raw outputをpublic media namespaceへ置かない。

## Protection and recovery

publication-time protection hard gate:

- `published-media-protection-contract.md`

missing/corrupt object restore:

- `media-recovery-contract.md`

public R2 objectを唯一のrecovery authorityにしない。

## Infrastructure boundary

site owns:

- object identity/key contract
- delivery variant profile/manifest
- required HTTP metadata semantics
- rights/provenance binding
- publication manifest
- protection/recovery requirement

`Xpotato-Server` owns:

- public/protected R2 resource
- custom domain/provider config
- credentials
- provider cache/rules if introduced
- protection/restore implementation
