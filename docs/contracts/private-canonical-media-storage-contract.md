---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - private canonical media source persistence
  - future media re-encoding source contract
---

# Private Canonical Media Storage Contract

## Purpose

公開済みmediaを将来新しいwidth/format/quality profileへ再生成できるよう、raw camera originalではなく**privacy-normalized lossless canonical master**をprivate object storageへ保持する。

public delivery bytesのrecoveryと、future re-encoding sourceを分離する。

## Planes

```text
raw source
  HEIC/JPEG/PNG/AI raw
  job/user input only
      |
      v
private canonical master
  lossless WebP / sanitized SVG
  metadata stripped / bounded dimensions
      |
      +----> private source-media R2
      |
      +----> delivery generation
                |
                v
        public master + variants
                |
                +----> public R2
                |
                +----> protected-media R2 exact copy
```

### Raw source

site publication SoTではない。

- private/local user input
- Article Job workspace input
- automatic Cloudflare uploadなし
- GPS/EXIF付きcamera originalをsite infrastructureへ恒久保存することをinitial requirementにしない

userがoriginal photo libraryを別backupで保持するかはsite architecture scope外。

### Private canonical master

future media reprocessing source。

initial raster profile:

```text
canonical-raster-srgb8-lossless-webp-v1
```

- lossless WebP
- max long edge 8192
- sRGB 8-bit
- orientation normalized
- private metadata stripped
- content-addressed immutable identity

sanitized SVGはvector canonical sourceとして同じprivate source planeへ置ける。

### Public delivery/protected bytes

current website correctness/recovery authority。

private canonical master loss失でもcurrent published siteを復旧できるよう、public master/variantsのexact protected copyを別に持つ。

## Storage requirement

initial provider implementationは**separate private source-media R2 bucket**を使用する。

requirements:

- no public custom domain
- no browser-facing route
- content-addressed immutable object keys
- no automatic expiration at launch
- normal source writer/readerにbucket configuration権限なし
- normal source writer/readerにDelete権限を要求しない
- bucket configuration adminは`Xpotato-Server` control-plane policyに従いoperator-held ephemeral

protected-media bucketとは分ける。

## Object identity

logical key:

```text
source/v1/objects/sha256/<first-two>/<sha256>.<ext>
```

bucket/account/provider IDはsite registryへ保存しない。

same exact canonical bytes -> same key。

same keyへdifferent bytes overwrite禁止。

## CanonicalSourceRecord

Git-visible Media Registry/provenanceにprivate provider locatorを保存しない。

```ts
interface CanonicalSourceRecord {
  schemaVersion: 1;
  contentId: ContentId;
  assetId: string;

  canonical: {
    sha256: string;
    format: "webp" | "svg";
    width?: number;
    height?: number;
    sizeBytes: number;
    ingestProfileId: string;
    ingestProfileSha256: string;
    toolchainSha256: string;
  };

  storageClass: "private_canonical_media_v1";
  storedAt: string;
}
```

provider-independent identityはcanonical SHA + storage class。

private bucket name/signed URL/credentialをrecordへ入れない。

## CanonicalSourceStorageReceipt

private upload/reuse後:

```ts
interface CanonicalSourceStorageReceipt {
  schemaVersion: 1;
  candidateSha256: string;
  contentId: ContentId;
  assetId: string;
  canonicalSha256: string;
  storageClass: "private_canonical_media_v1";
  action: "uploaded" | "reused";
  verifiedSizeBytes: number;
  storedAt: string;
  receiptSha256: string;
}
```

secret locatorを含めない。

## Article Job timing

private canonical mediaをcandidate approval前にremoteへ永続化しない。

initial publication path:

```text
VISUAL_AUDITED
 -> MEDIA_VARIANTS_READY
 -> CANDIDATE_READY
 -> PREVIEW_VALIDATED
 -> HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

理由:

- rejected visualでprivate source bucketを汚さない
- approved candidate hashにcanonical source SHA/profileをbindできる
- raw/job workspace cleanup前にfuture reprocessing sourceを確保する

media 0件またはsource persistence不要なfixed bundled assetではdeterministic `not_required` result可。

## Failure semantics

source storage failure:

- public media publicationへ進めない
- Git exportしない
- candidate/approvalは変更しない
- local canonical artifactを保持してidempotent retry

source bucket outageを理由にraw originalをpublic bucketへfallback uploadしない。

## Why no Bucket Lock on source-media initially

private canonical masterはfuture re-encoding authorityだが、**current published exact-byte recovery authorityではない**。

current published bytesはseparate protected-media bucketでindefinite lockされる。

source-media bucket launch policy:

- no automatic lifecycle expiration
- routine credential has no Delete
- content-addressed immutable writes
- Bucket Lock not required initially

とする。

これによりprivacy-safe reprocessing sourceを長期保持しつつ、将来explicit media retirement/cleanup designを完全に閉じない。

source bucket lossはpublication outageではなく`REPROCESSING_SOURCE_DEGRADED`として扱う。

source bucket自体のbackup/lockを将来hard requirement化する場合はseparate storage/recovery decision。

## Raw cleanup

human-approved canonical sourceがprivate source-media storageへverifyされ、public/protected publicationも完了した後、Article Job raw inputはjob retention policyに従って削除可能。

raw sourceを削除した事実を「original photo backup完了」と表現しない。

## Reprocessing

media profile update時:

1. Git Media Registry/CanonicalSourceRecordからexpected canonical SHAを取得
2. infra adapterでprivate canonical objectを取得
3. SHA/size verify
4. new variant profileでdeterministic generate
5. new Article/media update candidateとしてhuman review
6. approval後new public objects publish/protect
7. same semantic asset IDのregistryをnew object setへ更新

existing public objectをoverwriteしない。

## Ownership

### xpotato-site

owns:

- canonical media semantics/hash/profile
- source-storage receipt contract
- Article Job gate
- reprocessing workflow

### Xpotato-Server

owns:

- private source-media bucket actual resource/name
- credentials
- bucket configuration
- provider operation
- read-back/drift validation

## Validation

network-free:

- canonical record hash/profile valid
- no provider locator/secret in Git
- candidate binds canonical source SHA

external:

- approved source receipt resolves expected exact bytes
- source bucket has no public custom domain
- source writer cannot change bucket config/delete under normal credential
- source SHA can be retrieved and reprocessed in representative fixture
