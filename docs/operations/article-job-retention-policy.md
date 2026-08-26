---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - Article Job private workspace retention
  - raw/source snapshot cleanup policy
---

# Article Job Retention Policy v1

## Decision

Initial vNextではfull Article Job workspaceをlong-term archiveへ自動保存しない。

`.local/article-jobs/<job-id>/`は**ephemeral operational workspace**。ADR-0024をdecision rationaleとする。

Long-lived publication state:

- Git: approved content + compact cleanup-safe Publication Provenance
- private source-media: privacy-normalized canonical media source
- public media: approved delivery objects
- protected media: exact published delivery bytes recovery copy

Full request/response/log/source snapshot archiveをlaunch requirementにしない。

## Durable provenance prerequisite

Workspace cleanup前にGit provenanceがhash listだけでなく、少なくとも次を保持する必要がある:

- compact SourceRefs
- material claim -> evidence interpretation -> source binding
- compact AI/tool lineage
- canonical source identity/profile
- media publication/protection hashes
- secret-free compact media recovery binding derived from valid MediaProtectionReceipt

これによりworkspace cleanup後も:

- published material claimのsupportを追跡
- future source refreshのseed取得
- media reprocessing
- exact published media restore開始

が可能。

## Why full workspace is not durable by default

Full job archiveは:

- user-supplied private logs/files
- external source snapshots
- AI responses/prompts
- raw generated images
- temporary diagnostics

を長期集積し、privacy/storage/secret-scanning burdenを増やす。

VEP-like artifact/hash disciplineはjob実行中のcorrectnessとして維持し、全private bytes永久保存とは同一視しない。

## No automatic TTL deletion

Time-based background cleanupだけでworkspaceを消さない。

- export後でもdurable Git refへ未到達かもしれない
- receipt/bindingがstaleかもしれない
- partially published orphan trackingが必要かもしれない

Cleanupはexplicit deterministic operation。

## Successful-job cleanup eligibility

少なくとも:

1. state `EXPORTED`
2. operator-selected durable Git refへexpected MDX/frontmatter/registry/provenance bytesが存在
3. provenance content/candidate/approval hashes一致
4. all material claims have valid compact durable support bindings
5. required CanonicalSourceStorageReceipt set valid
6. required MediaPublicationManifest valid
7. required MediaProtectionReceipt valid
8. Git `mediaRecovery` compact binding exists when published media exists and exactly matches valid receipt/publication object set
9. no unresolved external side-effect/orphan tracking need
10. explicit operator confirmation

を満たすまでcleanup不可。

Receipt **hashだけ**を持つことをeligibilityにしない。Full receiptを消す前にrequired recovery subsetがdurable provenanceへmaterializeされている必要がある。

`merge`またはfinal target ref policyはimplementation workflow引数。Cleanup commandが「export済みだからmainにある」と推測しない。

## Cleanup command semantics

```text
site article cleanup <job-id> --git-ref <verified-ref>
```

Operation:

1. read-only eligibility check
2. durable claim/recovery binding validation
3. deletion plan表示
4. explicit confirm
5. exact job workspaceだけ削除
6. cleanup resultをlocal operator logへ記録

Git/R2 public/source/protected objectをcleanup commandからdeleteしない。

## What may be deleted

Eligibility後:

- raw HEIC/JPEG/PNG job copies
- external source snapshot bytes
- semantic request/response payloads
- intermediate draft revisions
- private detailed evidence/claim bundle
- technical verifier stdout/stderr
- raw provider image bytes
- local canonical master/variants
- full MediaProtectionReceipt/job manifests whose required durable subset has been verified in Git
- candidate preview screenshots/build trees

## What remains durable

### Git

- approved content
- ContentId/routes/taxonomy
- Media Registry
- compact CanonicalSourceRecord/profile
- compact SourceRefs
- compact material-claim evidence ledger
- compact AI run refs/hashes
- technical example summary/hash
- source/public/protection stage hashes
- compact media recovery binding including secret-free protected object refs

### Private source-media

- approved privacy-normalized canonical master

### Public/protected media

- approved public delivery set
- exact protected recovery set

## AI generated image raw bytes

Provider raw outputはgeneration/audit中はimmutable job artifactとして保持する。

Approved canonical sourceがprivate source storageへpersistされ、durable Git lineage成立後はraw provider bytesをcleanup可能。

Provider/model/request/raw hash等のcompact lineageはGitに残す。C2PA等raw-container metadataの永久保存はlaunch requirementにしない。

## User-supplied private data

User log/private fileをlong-term archiveするdefaultを設けない。

Published claimに必要なsupportはpublic-safe compact evidence summary + source identity/hashへ落とす。Private raw payloadをGit/source-mediaへ混ぜない。

## Cancelled/failed job

Operatorが不要と判断した時点でexplicit cleanup可能。ただしexternal publication side effectがある場合、orphan/recovery trackingを失わないことを先に確認する。

## Deep audit limitation

Cleanup後はfull semantic response/source snapshotを再閲覧できない場合がある。このtrade-offはADR-0024で明示受容する。

Future requirementでfull forensic/research archiveが必要になれば、separate encrypted/private artifact archiveとretention policyを新ADRで設計する。

## Validation

- cleanup before durable Git ref -> reject
- material claim binding missing/stale -> reject
- media published but compact recovery binding missing/mismatch -> reject
- receipt/hash/candidate/approval mismatch -> reject
- cleanup path escapes exact job workspace -> reject
- cleanup must not mutate Git/R2
