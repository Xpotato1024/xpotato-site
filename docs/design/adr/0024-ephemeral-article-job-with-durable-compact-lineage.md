---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0024: full Article Jobはephemeralとし必要なcompact lineageだけをdurable保存する

## Context

Article Jobはsource snapshots、AI requests/responses、draft revisions、verification logs、raw generated images、audits等、多数のprivate artifactsを生成する。

これらをVEP同様に永久保存すればdeep forensic replayは容易になる一方:

- user/private dataを長期蓄積する
- prompt/source snapshotのprivacy・secret-scanning burdenが増える
- storage/lifecycleがpublication platformの主要責務になる
- public content correctness/recoveryに不要なbytesまで恒久化する

一方、workspaceをcleanupするだけではmaterial claimのevidence mappingやmedia recovery locatorまで失われ、Product Contextのtraceability/recovery goalを満たせない。

## Decision

### Full workspace

`.local/article-jobs/<job-id>/`はephemeral operational stateとし、long-term private archiveをlaunch requirementにしない。

Automatic time-only TTLでは削除しない。Cleanupはdurable publication stateを検証したexplicit operationだけが行う。

### Durable Git lineage

Workspace cleanup後も次をGitへcompact/public-safeに残す:

- content/candidate/approval identity hashes
- compact SourceRefs
- **material claim -> source/evidence support binding**
- AI role/model/Skill/request/response hashes
- technical-example verification summary/hash
- canonical media source identity/profile
- media publication manifest hash
- media protection receipt hash
- **secret-free compact media recovery binding** derived from valid receipt

Private source body、prompt、reasoning、credential、signed URL、raw logsは保存しない。

### Durable media planes

- private canonical source: future re-encoding authority
- public delivery objects: active bytes
- private protected-media: exact published-byte recovery authority

Full job archiveをこの3役の代用にしない。

## Material claim binding

Durable provenance must retain enough information to answer after cleanup:

> このmaterial claimはどのvalidated source/evidence classに基づいたか？

Statement全文のduplicateを必須にせず、statement/span hash + article locator + support class + compact source referencesで表現できる。

Private-only sourceの場合もpublic-safe description/hashでtraceabilityを維持し、private source bodyはGitへ出さない。

## Media recovery binding

Full MediaProtectionReceiptはjob artifactでよいが、cleanup前にsecret-free recovery fieldsをGit provenanceへcompact materializeする。

At minimum:

- protection class
- policy fingerprint
- public object SHA/key/size
- opaque `protectedObjectRef`

`protectedObjectRef`はcredential/signed URL/account secretを含まない。

This allows recovery to begin after workspace cleanup while infra repo still owns actual protected bucket/resource mapping。

## Cleanup eligibility

Successful job cleanup requires:

1. exact exported content/provenance is present at operator-selected durable Git ref
2. compact material claim bindings validate
3. canonical source storage receipt chain validates where required
4. public media publication chain validates
5. compact media recovery binding matches valid protection receipt
6. no unresolved external side-effect/orphan tracking need
7. explicit operator confirmation

Cleanup never deletes Git/public/source/protected R2 objects。

## Alternatives

### Keep every Article Job artifact indefinitely

maximum forensic replayを得るがprivacy/storage burdenが大きく、current product requirementを超えるため不採用。

### Keep only hashes in Git

smallだがhash aloneではclaim support mappingやprotected restore locatorを復元できないため不採用。

### Keep no lineage after publication

future update/audit/recoveryがAI/provider/job memoryに依存するため不採用。

## Consequences

Positive:

- private operational data retentionを最小化できる。
- cleanup後もmaterial claimsをsource/evidenceへtraceできる。
- cleanup後もpublished media restoreを開始できる。
- Git historyがrevision lineageを保持する。

Costs:

- compact provenance schemaが少し大きくなる。
- exporterがfull job artifactsからsafe durable ledgerを生成/validateする必要がある。
- raw/private deep forensic replayはcleanup後できない場合がある。

## Revisit triggers

- research/regulated auditでfull prompt/source snapshot preservationがrequirement化
- private artifact archiveを安全に保つ別storage/retention policyが必要
- compact ledgerではincident analysisが不足する実例が出る

## Related

- `operations/article-job-retention-policy.md`
- `contracts/publication-provenance-contract.md`
- `contracts/published-media-protection-contract.md`
- `contracts/media-recovery-contract.md`
