---
status: proposed
owner: architecture
last_verified: 2026-08-26
---

# ADR-0020: published mediaはseparate private R2 bucketへindefinite protectionする

## Context

ADR-0014でphotographic/raster content mediaをR2-firstとし、ADR-0018でpublic mediaをGit export前にrecovery protectionすることを決めた。

しかしprotected destinationをpublic delivery bucket内prefixにするか、別bucketにするか、retentionを有限/無期限のどちらにするかは未確定だった。

vNextでは:

- Gitはmedia bytesを保持しない;
- media objectはcontent-addressed immutable;
- historical Git revision/rollbackから古いobjectが将来必要になり得る;
- normal Article Job publisherはpublic R2へ書く;

ため、public publisher compromise/accidentからrecovery bytesを強く分離する必要がある。

## Decision

Initial vNext protection classは:

- public delivery R2 bucketとは別の**private protected-media R2 bucket**;
- protected bucketにpublic custom domainを付けない;
- protected exact-byte objectsへ**Bucket Lock indefinite**;
- automatic deletion lifecycleなし;
- normal public publisherにprotected bucket accessなし;
- protection writerはput/head/read必要最小限で、delete/bucket config/lock変更なし;
- R2 bucket configuration adminは`Xpotato-Server` security policyに従うoperator-held ephemeral capability;
- provider-independent second copyはinitial hard requirementではない;

とする。

exact bucket name / provider ID / credential detailsはsite repoへ固定せず`Xpotato-Server` machine-readable SoTが所有する。

## Why separate bucket

public bucket内protected prefixより:

- public publisher credentialからbucket-levelで分離しやすい;
- protected bytesをpublic CDN/custom-domain surfaceから外せる;
- protected writer/restore credentialを独立できる;
- public bucket lifecycle/operational changeとrecovery copyを混ぜにくい。

## Why indefinite initial retention

current protected media量はsmallで、storage reclamationよりrecoverabilityを優先できる。

content-addressed old objectはGit history/rollbackで将来必要になり得るため、短期backup rotationと同じretention modelにしない。

Cloudflare R2 Bucket Lockはindefinite retentionをsupportする。

protected storage growthがmaterialになった時点で、retained Git refsを入力とするGC/retention redesignを別ADRで行う。

## Copy implementation

cross-bucket server-side CopyObject availabilityをarchitecture hard requirementにしない。

exact bytesが同一なら:

- verified provider-side copy;
- bounded GET -> PUT;

どちらも許容する。

MediaProtectionReceiptのSHA/size/object-set verificationがcorrectness authority。

## Consequences

### Positive

- public publisher compromiseからrecovery bucketを分離できる;
- historical media recoveryを長期維持しやすい;
- public custom domainからprotected bytesを切り離せる;
- article publication/protection/export transactionが明確になる。

### Negative

- second R2 bucketが必要;
- protected storageはinitially単調増加する;
- explicit future GC redesignが必要になる可能性;
- protection copy operationに別credential/operationが必要。

## Infrastructure ownership

Cross-repo provider implementation proposal:

- `Xpotato1024/Xpotato-Server`
- branch: `codex/site-vnext-cloudflare-control-plane`
- ADR-0024 proposal

site ADRがCloudflare provider object nameをsecond SoTとして持たない。

## References

- Cloudflare R2 Bucket Locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- `contracts/published-media-protection-contract.md`
- ADR-0018
