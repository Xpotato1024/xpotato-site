---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - Article Job AI prepare / run / import operations
---

# Article AI Exchange Operations

## Principle

semantic AIはfixed request + Skill snapshot + response schema。canonical artifact/state/writeはdeterministic executorが所有する。

example verification、media processing、source/public/protected storage、export/cleanupはAI Skillではない。

## CLI target shape

```text
site article init
site article guide
site article source ...
site article evidence prepare|import
site article author prepare|import
site article examples assess
site article audit prepare|import
site article revision prepare|import
site article visual-plan prepare|import
site article image generate|import
site article media ingest
site article visual-audit prepare|import
site article media variants
site article citations compile
site article candidate build
site article preview
site article review
site article approve
site article media source-store
site article media publish
site article media protect
site article export
site article cleanup --git-ref <ref>
```

convenience runnerはhuman confirm/upload/admin privilegeを自動補完しない。

## Semantic stages

source discovery -> deterministic pinning -> evidence -> author -> technical examples -> independent audit -> bounded revision -> visual plan/generation -> visual audit。

AI authorはfixed Source ID citation markerだけを使用する。

example verifier exact runtime/sandbox policy=`operations/technical-example-profiles.md`。

## Media ingest / audit / variants

`media ingest`:

- raw HEIC/JPEG/PNG等をprivate canonical masterへnormalize
- orientation/sRGB/private metadata strip
- raw sourceをpersistent R2へそのまま送らない

`visual-audit`:

- semantic visual/canonical master audit
- reject visualへvariantを生成しない

`media variants`:

- audited canonical master
- versioned delivery profile
- deterministic AVIF/WebP/fallback
- no network/Cloudflare Images/public upload

## Candidate / preview / approval

candidate binds:

- content/citations/examples/audits
- canonical source SHA/profile
- delivery variants/profile
- source storage/public/protection plans
- registry/provenance proposal

previewはlocal canonical/variant adapterを使う。

human approvalだけがcandidate hashをconfirmできる。

## Private canonical source storage

`article media source-store`は`HUMAN_APPROVED`でのみlegal。

`private-canonical-media-storage-contract.md`に従う。

- approved canonical source SHA/profile再検証
- separate private source-media storageへcontent-addressed upload/reuse
- raw originalはuploadしない
- no public domain
- exact size/hash verification
- CanonicalSourceStorageReceipt

failure:

- public publication禁止
- state=`HUMAN_APPROVED`
- local canonical sourceを保持してretry

media/source persistence不要candidateはdeterministic `not_required` result可。

## Public media publication

`MEDIA_SOURCE_STORED`後のみlegal。

- exact approved delivery master + required baseline variants
- content-addressed public R2
- immutable cache metadata
- complete-set verification
- MediaPublicationManifest

Cloudflare Images transform resultはcanonical set外。

failure時state=`MEDIA_SOURCE_STORED`。

## Protected media

`MEDIA_PUBLISHED`後のみlegal。

exact public object setをprivate protected-media recovery planeへcopy/reuseしMediaProtectionReceiptを得る。

failure時state=`MEDIA_PUBLISHED`、export禁止。

## Export

`MEDIA_PROTECTED`後のみlegal。

- candidate/approval/source-storage/publication/protection chain
- repository base

を再検証し、MDX/frontmatter/media registry/canonical source identity/compact provenanceをfeature branch/patchへexportする。

media bytesをGitへexportしない。

## Cleanup

`site article cleanup`はlong-term publication operationではなくprivate workspace cleanup。

`operations/article-job-retention-policy.md`に従う。

required:

- state EXPORTED
- exact exported bytesがoperator-supplied durable Git refに存在
- source/public/protection receipt chain valid
- explicit confirm

cleanupはexact job workspaceだけを削除する。

Git/R2 object deletionを行わない。

## Guide

read-onlyで:

- effective state
- next legal operation
- missing permission/profile
- stale artifact
- external side-effect class
- blockers

を表示する。

## Initial error classes

- `INVALID_JOB_SPEC`
- `CONTENT_ID_NOT_FOUND`
- `CONTENT_ID_AMBIGUOUS`
- `PERMISSION_DENIED`
- `SOURCE_PIN_FAILED`
- `REQUEST_FINGERPRINT_MISMATCH`
- `RESPONSE_SCHEMA_INVALID`
- `EVIDENCE_BINDING_INVALID`
- `CITATION_SOURCE_INVALID`
- `EXAMPLE_VERIFICATION_BLOCKED`
- `CONTENT_AUDIT_BLOCKED`
- `VISUAL_AUDIT_BLOCKED`
- `MEDIA_INGEST_FAILED`
- `MEDIA_VARIANT_FAILED`
- `CANDIDATE_STALE`
- `APPROVAL_REQUIRED`
- `APPROVAL_STALE`
- `MEDIA_SOURCE_STORAGE_FAILED`
- `MEDIA_SOURCE_STORAGE_MISMATCH`
- `MEDIA_PUBLICATION_FAILED`
- `MEDIA_PROTECTION_FAILED`
- `MEDIA_PROTECTION_MISMATCH`
- `EXPORT_MISMATCH`
- `CLEANUP_NOT_ELIGIBLE`

retryでconstraintを弱めない。
