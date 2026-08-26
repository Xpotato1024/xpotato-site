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

initial vNextではfull Article Job workspaceをlong-term R2 archiveへ自動保存しない。

`.local/article-jobs/<job-id>/`は**ephemeral operational workspace**。

permanent/long-lived publication stateは別planeへ既に分離されている:

- Git: MDX/frontmatter + compact Publication Provenance
- private source-media R2: privacy-normalized canonical media source
- public R2: approved delivery master/variants
- protected-media R2: exact published delivery bytes recovery copy

full request/response/log/source snapshot archiveをlaunch requirementにしない。

## Why

full job archiveは:

- user-supplied private logs/files
- external source snapshots
- AI responses
- raw generated images
- temporary diagnostics

を長期集積し、privacy/storage/secret-scanning burdenを増やす。

current publication correctness/recovery/update requirementsはcompact provenance + durable media planesで満たせる。

VEP-like stage/artifact/hash disciplineは**job実行中のreproducibility/correctness**として維持し、全private bytesの永久保存とは同一視しない。

## No automatic TTL deletion

time-based background cleanupだけでworkspaceを消さない。

理由:

- export後でもPR未mergeの場合がある
- rollback/revision修正中かもしれない
- clock/automationだけではdurable publication成立を証明できない

cleanupはexplicit deterministic operation。

## Cleanup eligibility

successful jobは少なくとも次を満たすまでcleanup不可:

1. state `EXPORTED`
2. expected MDX/frontmatter/registry/provenance bytesがGit commit/refへ存在
3. Git provenance hashesがjob candidate/approval/exportと一致
4. required CanonicalSourceStorageReceipt valid
5. required MediaPublicationManifest valid
6. required MediaProtectionReceipt valid
7. target Git revisionがoperator-selected durable repository historyに存在

`merge`またはfinal target refのexact policyはimplementation workflowで引数として渡す。cleanup commandが「export済みだからmainに入ったはず」と推測しない。

## Cleanup command semantics

conceptual:

```text
site article cleanup <job-id> --git-ref <verified-ref>
```

operation:

1. read-only eligibility check
2. deletion plan表示
3. explicit operator confirm
4. job-local/private workspaceだけ削除
5. cleanup recordをlocal operational logへ残す

Git/R2 public/source/protected objectをcleanup commandからdeleteしない。

## What may be deleted after eligibility

- raw HEIC/JPEG/PNG input copied into job workspace
- external source snapshot bytes
- semantic request/response payloads
- intermediate draft revisions
- technical verifier stdout/stderr
- visual generation raw provider bytes
- local canonical master copy
- local delivery variants
- candidate preview screenshots/build trees

## What remains durable

### Git

- approved content
- ContentId/routes/taxonomy
- Media Registry
- CanonicalSourceRecord hash/profile
- compact source refs
- compact AI run refs/hashes
- audit/evidence/citation/example manifest hashes as defined by provenance contract
- publication/storage/protection receipt hashes

### Private source-media

- approved privacy-normalized canonical master only

### Public/protected media

- approved public delivery object set
- exact recovery copy

## AI generated image raw bytes

provider raw outputはvisual generation/audit中はimmutable job artifactとして保持する。

approved canonical sourceがprivate source-mediaへpersistされ、Git durable revision条件が成立した後はraw provider bytesをworkspace cleanupで削除可能。

provider/model/request/raw hash等のcompact generation lineageはGit provenanceへ残す。

C2PA等raw-container metadataを永久保持することをinitial publication correctness requirementにしない。

将来reader/audit policyがraw provenance bytes保全を要求する場合はseparate private archive decision。

## User-supplied private data

user log/private fileをlong-term archiveするdefaultを設けない。

public articleに必要なfact/provenanceはredacted/compact recordへ落とし、private raw payloadをGit/R2 source-mediaへ混ぜない。

## Cancelled/failed job

operatorが不要と判断した時点でexplicit cleanup可能。

ただしcleanup前に:

- no needed human evidence remains
- no external publication side effect exists that needs recovery/GC tracking

を確認する。

partially published but unexported jobはpublic orphan trackingが必要なため、blind cleanupしない。

## Deep audit limitation

workspace cleanup後はfull semantic response/source snapshotを再閲覧できない場合がある。

initial designはこのtrade-offを受容する。

永久に必要なのはpublication identity/correctness/recovery sourceであり、full AI work historyではない。

if deep forensic/research audit becomes requirement:

- separate encrypted/private artifact archive
- artifact-class retention
- sensitive-data admission
- lifecycle

を新ADRで設計する。

## Validation

- cleanup cannot run before durable Git ref verification
- receipt/hash chain mismatch blocks cleanup
- cleanup never deletes R2 objects
- cleanup never rewrites Git
- private/raw files are not silently copied to long-term object storage
- cleanup plan has no path outside exact job workspace
