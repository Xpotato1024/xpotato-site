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

そのため、Git revisionをmedia identityの唯一の記録として残しつつ、bytes自体がpublic delivery bucketだけに存在する状態をaccepted publication stateにしない。

**Git export前に、approved public media objectのrecovery copyが検証済みであることを要求する。**

## Ownership boundary

`xpotato-site` owns:

- protectionが必要なobject identity
- expected SHA-256 / size / object key
- protection receipt schema
- Article Job gate

`Xpotato-Server` owns:

- backup/protected bucket or prefix
- Bucket Lock / lifecycle / retention
- object-copy implementation
- credential / permission separation
- restore operation / drill
- provider-specific desired state

site repoへbackup bucket ID / account ID / credentialを複製しない。

## Initial protection level

vNext launchのminimumはCloudflare内での**destruction-resistant protected copy**とする。

current infrastructure backup architectureですでに使用しているprotected-copy / Bucket Lock patternをwebsite media data classへ拡張する。

provider-independent second copyはinitial launch hard requirementにしない。必要性はinfra-wide DR decisionとして別途扱う。

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

requestはalready-published immutable objectだけを対象にする。

AI / semantic Skillはprotection成功を自己申告できない。

## Required behavior

infra-owned protection operationはobjectごとに:

1. public R2 source object identityを検証
2. protected destinationへcopy/reuse
3. protected copy size / identityを検証
4. required retention/protection policy適用を確認
5. restore locatorをsecret-free opaque identityとしてreceiptへ返す

source objectをprotected copy作成のためにmutateしない。

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

`protectedObjectRef`はsite codeが通常配信に使うURLではない。credential / signed URL / account IDを含めない。

## Article Job gate

normal path:

```text
HUMAN_APPROVED
  -> MEDIA_PUBLISHED
  -> MEDIA_PROTECTED
  -> EXPORTED
```

`EXPORTED` candidateがpublic mediaを参照する場合、valid protection receipt必須。

media objectが0件のcandidateではempty/none protection resultをdeterministicに表現できる。

## Failure semantics

public upload成功・protection失敗時:

- Git exportしない
- candidate / approvalを変更しない
- public content routeから新objectを参照しない
- stateは`MEDIA_PUBLISHED`に留める
- same immutable objectでidempotent protection retry

この状態のunreferenced public objectはorphan candidateになり得るが、content-addressed objectなので安全に再利用できる。

## Recovery requirement

migration cutover前にrepresentative protected objectについて:

- protected copy read-only verification
- public delivery object欠損を仮定したrestore procedure
- restored bytes SHA-256一致

を1回以上実証する。

routine publicationごとのfull restore drillは不要。receipt + scheduled infra validationを利用する。

## Retention

exact days / lock period / lifecycleはinfra machine-readable SoTが所有する。

site側requirement:

- current Git revisionが参照するobjectはrecovery可能
- rollback windowで必要なpublished objectを保護
- protectionなしのpublic objectだけを唯一のcopyにしない

## Validation

repository export validator:

- Media Registry object -> MediaPublicationManifest
- MediaPublicationManifest -> MediaProtectionReceipt
- SHA / candidate / approval chain一致

を検査する。

production integration validationではprotection service / current infra receipt pathをsmokeする。
