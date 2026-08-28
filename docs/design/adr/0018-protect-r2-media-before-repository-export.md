---
status: proposed
owner: architecture
last_verified: 2026-08-26
---

# ADR-0018: published delivery mediaをrepository export前にexact-byte protectionする

## Context

R2-firstでGitからphotographic/raster bytesを外すと、public delivery objectを失った場合にGitだけではbytesを復元できない。

ADR-0015によりpersistent media mutationはhuman approval後で、private canonical source storageとpublic delivery publicationを順に行う。

Private canonical sourceはfuture re-encoding sourceであり、現在公開したJPEG/PNG/WebP/AVIFの**exact bytes**を保証するrecovery authorityではない。

Content-addressed keyはoverwrite事故を減らすが、delete/credential compromise/account/operator error/provider lossへのbackupではない。

## Decision

Public delivery object setをGit revisionが参照する前に、exact bytesのdestruction-resistant recovery copyを成立させる。

Required path:

```text
HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

`MEDIA_PROTECTED` requires:

- same candidate/approval identity
- exact MediaPublicationManifest object set
- SHA/size verification
- accepted protection class/policy
- secret-free recovery binding derivable from valid receipt

Initial proposal protection classの詳細はADR-0020。Provider implementationは`architecture/infrastructure-handoff.md`でpinしたinfra proposalのscope。

## Ownership

`xpotato-site` owns:

- public object identity/hash/key/size semantics
- protection request/receipt and durable compact recovery-binding semantics
- Article Job gate
- export/recovery validation

`Xpotato-Server` owns:

- actual protected resource
- Bucket Lock/lifecycle/retention
- copy/restore implementation
- provider credentials and drift validation

Provider IDs/credentialsをsite SoTへ複製しない。

## Failure semantics

If public publication succeeds but protection fails:

- do not export Git content/registry
- stay `MEDIA_PUBLISHED`
- keep candidate/approval/publication manifest immutable
- retry protection against same content-addressed objects

Unreferenced public objects may exist but are not referenced by canonical Git content。

## Durable recovery binding

Full job workspaceはlater cleanupされ得るため、receipt hashだけでは不十分。

Repository export時にvalid MediaProtectionReceiptからsecret-free compact bindingをPublication Provenanceへmaterializeする。少なくとも:

- protection class
- policy fingerprint
- public object key/SHA/size
- opaque protected object reference

を保持し、workspace cleanup後もrecovery operationを開始できることを要求する。

This compact binding must not contain credential/signed URL/account secret。

## Migration

Legacy bulk migrationはmigration-operator authorizationを使えるが、old Git rasterをactive treeから削除する前に:

- public object set verified
- exact protected-copy coverage
- durable recovery binding
- representative restore SHA equality

を要求する。

## Consequences

Positive:

- public delivery R2が唯一のrecovery copyにならない。
- Git rollback revisionが必要なexact media bytesをrestore可能にできる。
- source-media reprocessingとpublished exact recoveryを分離できる。

Costs:

- publicationにexternal protection stageが増える。
- receipt/binding validationが必要。
- protection失敗時はpublic upload済みでもGit exportがblockする。

## Related

- `contracts/published-media-protection-contract.md`
- `contracts/media-recovery-contract.md`
- `contracts/publication-provenance-contract.md`
- ADR-0015
- ADR-0020
