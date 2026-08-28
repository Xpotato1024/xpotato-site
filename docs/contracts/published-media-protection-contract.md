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

Git export前にapproved public media objectのexact-byte recovery copyを検証し、**workspace cleanup後もrestoreを開始できるsecret-free bindingをdurable provenanceへ残す**ことを要求する。

## Ownership boundary

`xpotato-site` owns:

- protection対象public object identity
- request/receipt schema
- durable compact recovery-binding derivation/validation
- Article Job gate

`Xpotato-Server` owns:

- actual protected-media provider resource/config
- Bucket Lock/lifecycle/retention
- copy/restore implementation
- credential separation
- drift/read-back/drills

Exact provider resource name/account/credentialはsite repoへcanonical duplicateしない。

Provider proposal/adoption statusは`../architecture/infrastructure-handoff.md`。

## Initial protection class

```text
cloudflare_protected_copy_v1
```

Proposed semantics:

- public deliveryとはseparate private protected-media R2 plane
- no public custom domain
- exact published delivery bytes
- indefinite Bucket Lock
- automatic deletion lifecycleなし
- public publisherにprotected accessなし
- protection writerにDelete/config/lock mutationなし
- provider-independent second copyはinitial launch hard requirementではない

This is a site design target while infra ADR-0024 remains Proposed; this contract does not itself authorize provider mutation。

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

Requestはalready-published immutable public objectだけを対象にする。AI/Skillはsuccessを自己申告できない。

## Required behavior

Infra-owned operation:

1. public source object SHA/key/size verify
2. protected destinationへexact bytes copy/reuse
3. protected SHA/size verify
4. required protection policy read-back verify
5. secret-free opaque protected object referenceをreturn

Public objectをprotectionのためにmutateしない。

Cross-bucket server-side CopyObjectをhard requirementにしない。Verified provider-side copyまたはbounded verified GET -> PUTでsame exact bytesを成立させる。

## Protection writer credential

Target capability:

- public source: read/head as needed
- protected destination: put/head as needed
- no protected delete
- no bucket config/lock/lifecycle mutation

Exact provider permissionはinfra implementation SoT。

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

`protectedObjectRef` requirements:

- secret-free
- no signed URL/token/credential
- stable enough for infra recovery adapter to resolve later
- need not reveal actual bucket/account/provider ID to site content

## Durable compact binding before cleanup

Full receipt may remain private Article Job artifact. Therefore valid receiptだけではcleanup-safe recoveryにならない。

Repository exporter must derive `PublicationProvenanceRecord.mediaRecovery` according to `publication-provenance-contract.md`:

```text
valid MediaProtectionReceipt
 + exact MediaPublicationManifest
       |
       v
CompactMediaRecoveryBinding
       |
       v
Git Publication Provenance
```

Compact binding includes:

- protectionClass
- policyFingerprint
- full receipt SHA
- each required public object SHA/key/size
- each `protectedObjectRef`

Export must verify compact object-set exactly equals current required MediaPublicationManifest object-set and receipt object-set。

Receipt hash alone is not sufficient for workspace cleanup。

## Article Job gate

```text
HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

`MEDIA_PROTECTED` means full receipt valid。`EXPORTED` additionally means durable compact recovery binding was successfully materialized/validated in Git provenance。

Media object 0件ではdeterministic empty resultをuseできる。

## Failure semantics

Public upload success / protection failure:

- Git export禁止
- candidate/approval/publication manifest immutable
- state=`MEDIA_PUBLISHED`
- same public objectでidempotent retry

Protection success but durable binding export failure:

- repository export success扱いにしない
- full receipt/job artifactsをcleanupしない
- same receiptからdeterministic binding generationをretry

## Retention / GC

Initial protected policy:

- indefinite Bucket Lock
- automatic expirationなし
- automatic GCなし

Future storage reclamation is separate privileged/ADR scope and must consider retained Git refs + durable recovery bindings。

## Recovery requirement

Before migration cutover:

- representative protected object read
- use durable compact binding to locate protected object through infra adapter
- simulate public object loss
- restore exact SHA/size
- republish expected content-addressed public key

Routine publication毎のfull restoreは不要。Periodic infra validation/drillsを使う。

## Provider/admin trust

Bucket Lock/config adminをsite Article Job/site deployへ与えない。Infra proposal uses Git-driven desired state + operator-authorized ephemeral admin capability。

## Validation

Repository export:

- public object -> MediaPublicationManifest
- publication object set -> full MediaProtectionReceipt exact equality
- receipt -> compact mediaRecovery exact equality
- candidate/approval/hash/size chain一致
- protectedObjectRef secret-free

Cleanup:

- valid compact binding exists for every protected required object
- full receipt SHA recorded

External:

- protected plane private
- lock/policy matches accepted infra state when activated
- public publisher/protection writer privilege separation
- representative restore through durable binding succeeds
