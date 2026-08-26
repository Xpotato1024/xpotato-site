---
status: proposed
owner: architecture
last_verified: 2026-08-26
---

# ADR-0020: published mediaはseparate private R2 bucketへindefinite protectionする

## Context

ADR-0014でphotographic/raster mediaをR2-firstとし、ADR-0018でpublic mediaをGit export前にexact-byte recovery protectionすることを提案する。

Protected destinationをpublic bucket内prefixにするか別bucketにするか、retentionを有限/無期限のどちらにするかは独立decisionである。

vNextでは:

- Gitはmedia bytesを保持しない
- public objectはcontent-addressed immutable
- historical Git revision/rollbackからold bytesが必要になり得る
- normal publisherはpublic delivery planeへwriteする

ため、publisher compromise/accidentからrecovery bytesを分離する必要がある。

## Decision

Initial vNext protection target:

- public delivery planeとは別の**private protected-media R2 bucket**
- public custom domainなし
- exact published delivery objectsへ**Bucket Lock indefinite**
- automatic deletion lifecycleなし
- public publisherにprotected accessなし
- protection writerはput/head/read必要最小限、delete/config/lock mutationなし
- R2 configuration adminはoperator-held ephemeral capability
- provider-independent second copyはinitial hard requirementではない

Exact provider resource name/ID/credentialはsite ADRへ固定しない。

The current infrastructure counterpart remains **Proposed**. `architecture/infrastructure-handoff.md`にpinされたexact infra revision/statusをauthorityとし、infra acceptance後にのみmachine-readable provider desired stateへexact valuesを昇格する。

This ADR does not authorize R2 resource creation while provider sub-gate is blocked。

## Why separate bucket

Public bucket内prefixより:

- public publisherからbucket-levelで分離しやすい
- public CDN/custom-domain surfaceから外せる
- recovery writer/reader privilegeを独立できる
- public operational lifecycleとrecovery retentionを混ぜにくい

## Why indefinite initial retention

Early storage reclamationよりrecoverabilityを優先する。

Content-addressed old objectsはretained Git history/rollbackで必要になり得るためshort rotation backupとして扱わない。

Storage growthがmaterialになった場合はretained Git refsを入力とするprivileged GC/lock redesignを別ADRで扱う。

## Copy implementation

Cross-bucket server-side CopyObjectをhard requirementにしない。

- verified provider-side copy
- bounded verified GET -> PUT

のいずれでもsame exact SHA/sizeを成立させればよい。

Full MediaProtectionReceipt + durable CompactMediaRecoveryBindingがcorrectness/recovery authority。

## Consequences

Positive:

- public publisher compromiseからrecovery planeを分離
- historical media recoveryを長期維持
- public delivery URLからprotected bytesを隔離
- publication/protection/export transactionが明確

Costs:

- separate provider resource/credential boundaryが必要
- protected storageはinitially単調増加
- future GC redesignの可能性

## Infrastructure ownership

Provider implementation status/identity:

- `architecture/infrastructure-handoff.md`

Site ADRにmutable branch nameやCloudflare bucket nameをsecond SoTとして書かない。

## Related

- `contracts/published-media-protection-contract.md`
- `contracts/media-recovery-contract.md`
- ADR-0018
- ADR-0024
