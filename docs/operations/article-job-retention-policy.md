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

Full request/response/log/source snapshot/disclosure manifest archiveをlaunch requirementにしない。

## Durable provenance prerequisite

Workspace cleanup前にGit provenanceがhash listだけでなく、少なくとも次を保持する必要がある:

- compact SourceRefs
- material claim -> evidence interpretation -> source binding
- compact AI/tool lineage
- external AIを使用したrunではsafeなdisclosure policy / request-manifest hash lineage
- canonical source identity/profile
- media publication/protection hashes
- secret-free compact media recovery binding derived from valid MediaProtectionReceipt

これによりworkspace cleanup後も:

- published material claimのsupportを追跡
- external AI runがどのdisclosure policy/manifest identityで実行されたか監査
- future source refreshのseed取得
- media reprocessing
- exact published media restore開始

が可能。

Durable disclosure lineageは**private input内容を復元するためのarchiveではない**。Policy ID/hash、manifest hash、run/request hash等のsafe identityだけを保持し、private source body/pathやsecret-bearing authorization detailはGitへ出さない。

## Why full workspace is not durable by default

Full job archiveは:

- user-supplied private logs/files
- external source snapshots
- ExternalAiDisclosureRecord / request disclosure manifests
- AI responses/prompts
- raw generated images
- temporary diagnostics

を長期集積し、privacy/storage/secret-scanning burdenを増やす。

VEP-like artifact/hash disciplineはjob実行中のcorrectnessとして維持し、全private bytes永久保存とは同一視しない。

## No automatic TTL deletion

Time-based background cleanupだけでworkspaceを消さない。

- export後でもdurable Git refへ未到達かもしれない
- claim/recovery/disclosure lineageがstaleかもしれない
- partially published orphan trackingが必要かもしれない
- disclosure/security incident investigation中かもしれない

Cleanupはexplicit deterministic operation。

## Successful-job cleanup eligibility

少なくとも:

1. state `EXPORTED`
2. operator-selected durable Git refへexpected MDX/frontmatter/registry/provenance bytesが存在
3. provenance content/candidate/approval hashes一致
4. all material claims have valid compact durable support bindings
5. external AI runがある場合、required safe disclosure policy/manifest/run hash lineageがGit provenanceに存在し、run request identityと一致
6. required CanonicalSourceStorageReceipt set valid
7. required MediaPublicationManifest valid
8. required MediaProtectionReceipt valid
9. Git `mediaRecovery` compact binding exists when published media exists and exactly matches valid receipt/publication object set
10. no unresolved external side-effect/orphan/disclosure-security incident tracking need
11. explicit operator confirmation

を満たすまでcleanup不可。

Receipt/bundle/disclosure-manifest **hashだけ**を持つことが常に十分という意味ではない。Long-term correctness/recoveryに必要なsemantic subsetはdurable provenanceへmaterializeし、privacy上不要なfull private artifactsは逆に残さない。

`merge`またはfinal target ref policyはimplementation workflow引数。Cleanup commandが「export済みだからmainにある」と推測しない。

## Cleanup command semantics

```text
site article cleanup <job-id> --git-ref <verified-ref>
```

Operation:

1. read-only eligibility check
2. durable claim/recovery/external-run lineage validation
3. unresolved orphan/security tracking check
4. deletion plan表示
5. explicit confirm
6. exact job workspaceだけ削除
7. cleanup resultをlocal operator logへ記録

Git/R2 public/source/protected objectをcleanup commandからdeleteしない。

## What may be deleted

Eligibility後:

- raw HEIC/JPEG/PNG job copies
- external source snapshot bytes
- private ExternalAiDisclosureRecord / ExternalAiDisclosureManifest bodies
- local redacted/derived disclosure artifacts that are no longer needed for durable content/evidence/recovery and are not under incident hold
- semantic request/response payloads
- intermediate draft revisions
- private detailed evidence/claim bundle
- technical verifier stdout/stderr
- raw provider image bytes
- local canonical master/variants
- full MediaProtectionReceipt/job manifests whose required durable subset has been verified in Git
- candidate preview screenshots/build trees

`allow_derived_only`で作ったprivate derivativeをcleanupした後、Gitにそのprivate bodyを復元可能な形で保存しない。必要なpublished claim supportはpublic-safe compact evidence/source semanticsへ既に落ちていることが前提。

## What remains durable

### Git

- approved content
- ContentId/routes/taxonomy
- Media Registry
- compact CanonicalSourceRecord/profile
- compact SourceRefs
- compact material-claim evidence ledger
- compact AI run refs/hashes
- external AI runのsafe disclosure policy ID/hash + request disclosure manifest hash where applicable
- technical example summary/hash
- source/public/protection stage hashes
- compact media recovery binding including secret-free protected object refs

### Private source-media

- approved privacy-normalized canonical master

### Public/protected media

- approved public delivery set
- exact protected recovery set

## External AI disclosure retention

Exact disclosure semantics=`../contracts/external-ai-disclosure-contract.md` / ADR-0026。

During job execution, keep enough private artifacts to verify:

- exact input/hash admission
- exact vs derived mode
- hard-deny secret checks
- request manifest = actual outbound provider input set
- request/run manifest hash consistency

After cleanup eligibility:

- full private disclosure records/manifests may be removed
- private source inventory/body/path should not be copied into Git merely for audit convenience
- safe policy/manifest/run hash lineage remains durable
- if a disclosure/security incident is unresolved, relevant private artifacts are placed under explicit incident hold and cleanup is blocked for those artifacts/job until disposition

The normal retention policy does not promise forensic reconstruction of every outbound private byte after cleanup; it guarantees that publication correctness, material-claim support, and required safe run lineage remain intact without retaining unnecessary sensitive payloads。

## AI generated image raw bytes

Provider raw outputはgeneration/audit中はimmutable job artifactとして保持する。

Approved canonical sourceがprivate source storageへpersistされ、durable Git lineage成立後はraw provider bytesをcleanup可能。

Provider/model/request/raw/disclosure-manifest hash等のcompact lineageはGitに残せる。C2PA等raw-container metadataの永久保存はlaunch requirementにしない。

## User-supplied private data

User log/private fileをlong-term archiveするdefaultを設けない。

Published claimに必要なsupportはpublic-safe compact evidence summary + source identity/hashへ落とす。Private raw payloadをGit/source-mediaへ混ぜない。

External AIへ利用する場合もbroad job permissionではなくexact disclosure admissionを要求し、cleanup後にprivate payloadを再保存する理由にはしない。

## Cancelled/failed job

Operatorが不要と判断した時点でexplicit cleanup可能。ただし:

- external provider call/publication side effectがある場合、必要なorphan/security/audit trackingを失わない
- accidental disclosure incidentが疑われる場合、evidenceをincident hold前に削除しない

ことを先に確認する。

## Deep audit limitation

Cleanup後はfull semantic response/source snapshot/private disclosure manifestを再閲覧できない場合がある。このtrade-offはADR-0024/0026で明示受容する。

Future requirementでfull forensic/research archiveが必要になれば、separate encrypted/private artifact archive + admission/retention/access policyを新ADRで設計する。

## Validation

- cleanup before durable Git ref -> reject
- material claim binding missing/stale -> reject
- external AI run with missing/mismatched safe disclosure lineage -> reject
- media published but compact recovery binding missing/mismatch -> reject
- receipt/hash/candidate/approval mismatch -> reject
- unresolved orphan/disclosure-security incident -> reject
- cleanup path escapes exact job workspace -> reject
- cleanup must not mutate Git/R2
- cleanup must not copy private disclosure/source body into durable Git as a workaround
