---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - published content media recovery requirements
  - exact media restore semantics
---

# Media Recovery Contract

## Purpose

R2-firstによりGitはphotographic/raster media bytesを保持しない。この文書はpublished media欠損・破損後のexact restore semanticsを定義する。

Publication-time protected copy/receiptは`published-media-protection-contract.md`、durable cleanup-safe bindingは`publication-provenance-contract.md`を正とする。

## Principle

Public delivery mediaはactive copyであり唯一のrecovery authorityではない。

Restoreは「似た画像を作り直す」のではなく、current/retained Git revisionが要求するexact published bytesをrecovery planeから復元する。

## Durable recovery identity

Workspace cleanup後のnormal recovery entrypointはGitの:

- Media Registry: expected public SHA/key/size/format
- Publication Provenance `mediaRecovery`: protection class/policy/full receipt hash/protectedObjectRef

である。

Full private MediaProtectionReceiptがjob workspaceから削除済みでも、durable compact bindingだけでinfra recovery adapterへexact protected objectを要求できなければならない。

## Protection relationship

```text
HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

`MEDIA_PROTECTED`でfull receiptを検証し、`EXPORTED`でそのreceiptからdurable compact recovery bindingをGitへmaterialize/verifyする。

## Recovery backend requirements

Infra owner must provide:

- public deliveryとは別のprotected recovery plane
- accidental delete/overwriteへのdestruction resistance
- `protectionClass + protectedObjectRef`をactual protected objectへresolveするadapter/runbook
- expected SHA/size verification
- public publisherとrecovery privilegeの分離
- periodic integrity/policy validation
- representative restore drill

Provider/account independenceは別DR class。Initial proposalはsame-provider destruction-resistant copy。

## Recovery procedure after job cleanup

Public object missing/corrupt:

1. target Git revisionを固定
2. Media Registryからexpected public object SHA/key/size/typeを取得
3. same revisionのPublication Provenanceから`mediaRecovery`を取得
4. `mediaRecovery.objects`にexpected SHA/keyがexactly one存在することを確認
5. protectionClass/policyFingerprint/full receipt SHAをrecord
6. infra recovery adapterへ`protectionClass + protectedObjectRef + expected SHA/size`を渡す
7. private recovery stagingへbytes restore
8. SHA-256 / size / media type verify
9. expected content-addressed public keyへpublish/reuse
10. public object identity/availability verify
11. site render/smoke
12. recovery/incident record

Full Article Job workspaceやpast chatを必要としない。

## If full receipt is still available

Full MediaProtectionReceiptが存在する場合はcompact bindingとcross-checkできる。

- receipt hash equality
- object-set equality
- policy fingerprint equality
- protectedObjectRef equality

Mismatch時はrestoreを推測継続せず`RECOVERY_BINDING_MISMATCH`としてBLOCKする。

## Canonical source relationship

Private canonical source-mediaはfuture re-encoding authorityでありcurrent public exact-byte recovery authorityではない。

Protected exact bytesが失われた場合、canonical sourceからsame processing profileで再生成を試すことはsecondary reconstruction pathになり得るが、encoder/toolchainによりbyte-identicalを保証できないためnormal exact recoveryとは区別する。

Raw HEIC/original/provider imageの再生成をrecovery authorityにしない。

## AI-generated media

Same prompt/modelからsame bytesを再生成できると仮定しない。Protected published bytesをnormal recovery authorityとする。

## Migration

Old Git raster copiesをactive treeから削除する前に:

- public object verified
- full protection receipt coverage
- durable compact recovery binding exported
- compact bindingだけを入口にしたrepresentative restore PASS
- restored SHA equality

を要求する。

## Ownership

### xpotato-site

- expected object identity semantics
- Media Registry/provenance durable recovery binding
- broken object detection
- restore acceptance SHA/size

### Xpotato-Server

- actual protected resource mapping
- credentials
- provider configuration/lock
- `protectedObjectRef` resolver
- restore implementation/drill

Provider bucket/account IDsやcredentialをsite repoへduplicateしない。

## Validation

Site-side:

- every active published media object has current mediaRecovery binding when required
- binding object set matches Media Registry/publication lineage
- protectedObjectRef present and secret-free
- full receipt SHA recorded

External:

- durable binding resolves actual protected bytes
- restored SHA/size matches
- protected policy matches accepted infra state
- expected non-admin credential cannot delete/unlock protected object
