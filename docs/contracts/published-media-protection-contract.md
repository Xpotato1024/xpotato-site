---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - published website media recovery protection requirement
  - media protection receipt contract
---

# Published Media Protection Contract

## Purpose

R2-first mediaではGit repositoryがpublic media bytesを保持しない。

そのため、Git revisionをmedia identityの記録として残しつつ、bytes自体がpublic delivery bucketだけに存在する状態をaccepted publication stateにしない。

**Git export前に、approved public media objectのexact-byte recovery copyが検証済みであることを要求する。**

## Ownership boundary

`xpotato-site` owns:

- protection対象object identity
- expected SHA-256 / size / object key
- protection request/receipt semantics
- Article Job gate

`Xpotato-Server` owns:

- protected-media private R2 bucket resource/desired identity
- Bucket Lock / lifecycle / retention
- object-copy implementation
- credential/permission separation
- restore operation/drill
- provider-specific reconciliation

site repoへprotected bucket name/ID/account ID/credentialをcanonical duplicateしない。

## Initial protection class

vNext initial protection class:

```text
cloudflare_protected_copy_v1
```

semantics:

- public delivery bucketとは**別のprivate R2 bucket**;
- public custom domainなし;
- protected mediaはcontent-addressed exact bytes;
- bucket/prefixに**indefinite Bucket Lock**;
- automatic delete lifecycleなし;
- normal public media publisherにprotected bucket accessなし;
- normal protection writerにDelete / Bucket Lock / lifecycle / bucket config permissionなし;
- provider-independent second copyはinitial launch hard requirementではない。

理由:

- public publisher compromiseとrecovery bytesをbucket単位で分離する;
- protected copyをpublic CDN surfaceから分離する;
- Git historyが将来参照し得るimmutable mediaを短期rotation backupとして扱わない;
- initial scaleではstorage reclamationよりrecoverabilityを優先する。

exact protected bucket nameはinfra machine-readable SoTだけが所有する。

## ProtectionRequest

```ts
interface MediaProtectionRequest {
  schemaVersion: 1;
  candidateSha256: string;
  approvalRecordSha256: string;
  mediaPublicationManifestSha256: string;
  objects: Array<{
    sha256: string;
    objectKey: string;
    sizeBytes: number;
  }>;
}
```

requestはalready-published immutable public objectだけを対象にする。

AI / semantic Skillはprotection成功を自己申告できない。

## Required behavior

infra-owned protection operationはobjectごとに:

1. public R2 source identityをverify
2. private protected destinationへexact bytesをcopy/reuse
3. protected copy SHA/sizeをverify
4. required protection policyがactiveであることをread-back verify
5. secret-free opaque restore referenceをreceiptへ返す

source public objectをprotectionのためにmutateしない。

### Copy implementation portability

cross-bucket provider-side CopyObjectをhard requirementにしない。

implementationは:

- provider-side cross-bucket copyがverified supportedなら利用;
- otherwise bounded verified GET from public -> PUT to protected;

のいずれでもよい。

correctness requirementはsame exact SHA/sizeのprotected bytesが成立すること。

## Protection writer credential

initial target capability:

- source public bucket: read/head only as needed;
- destination protected bucket: put/head only as needed;
- protected delete禁止;
- bucket configuration / lock / lifecycle modification禁止。

短期/path/action scoped temporary credentialを利用できる場合は候補とするが、parent credentialのtrust boundaryも別途評価する。

## MediaProtectionReceipt

```ts
interface MediaProtectionReceipt {
  schemaVersion: 1;
  candidateSha256: string;
  approvalRecordSha256: string;
  mediaPublicationManifestSha256: string;

  protectionClass: "cloudflare_protected_copy_v1";

  objects: Array<{
    sha256: string;
    sourceObjectKey: string;
    verifiedSizeBytes: number;
    protectedObjectRef: string;
    protectedAt: string;
  }>;

  policyFingerprint: string;
  completedAt: string;
  receiptSha256: string;
}
```

`protectedObjectRef`はsite codeが通常配信に使うURLではない。credential/signed URL/account/bucket IDを含めないopaque identity。

## Article Job gate

```text
HUMAN_APPROVED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

public mediaを持つ`EXPORTED` candidateはvalid protection receipt必須。

media object 0件ではdeterministic empty/none protection result可。

## Failure semantics

public upload成功・protection失敗:

- Git exportしない
- candidate/approval/publication manifestを変更しない
- public content routeから新objectを参照しない
- state=`MEDIA_PUBLISHED`
- same immutable objectでidempotent protection retry

unreferenced public objectはorphan candidateになり得るがnormal Article Jobがdeleteしない。

## Retention / GC

initial protected-media policy:

- indefinite Bucket Lock
- automatic expirationなし
- normal automatic GCなし

将来protected storage growthがmaterialになった場合のみ:

- current Media Registries
- retained Git refs/releases/tags
- publication/protection manifests
- rollback/recovery requirement

を入力とするprivileged GC + lock redesignを別ADRで設計する。

site content deletionだけでprotected bytesを削除しない。

## Recovery requirement

migration cutover前にrepresentative protected master/variantについて:

- protected object read verification
- public object欠損を仮定したrestore
- restored SHA/size一致
- public content-addressed keyへのrepublication

を1回以上実証する。

routine publicationごとのfull restore drillは不要。receipt + periodic infra validationを利用する。

## Provider/admin trust

Bucket Lock configuration admin credentialをsite Article Job / site deploy workflowへ与えない。

`Xpotato-Server`のR2 root-of-trust policyに従い、security-sensitive bucket configはGit desired state + operator-authorized ephemeral admin reconcileで管理する。

Dashboard manual configurationをnormal prerequisiteにしない。

## Validation

repository export:

- Media Registry required object -> MediaPublicationManifest
- MediaPublicationManifest required object -> MediaProtectionReceipt
- object set exact equality
- SHA/size/candidate/approval chain一致
- accepted protection class/policy fingerprint

external integration:

- protected bucket private
- indefinite lock read-back
- no automatic lifecycle expiry
- public publisher cannot access protected bucket
- protection writer cannot delete protected object / mutate lock config
- representative restore drill succeeds
