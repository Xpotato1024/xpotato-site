---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - Article Job AI prepare / run / import operations
---

# Article AI Exchange Operations

## Principle

Semantic AI = fixed request + exact Skill snapshot + response schema。Canonical artifact/state/writeはdeterministic executor所有。

Example verification、media processing、source/public/protected storage、durable provenance export、cleanupはAI Skillではない。

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

Convenience runnerはhuman confirm/upload/admin privilegeを自動補完しない。

## Semantic stages

source discovery -> deterministic pinning -> evidence -> author -> technical examples -> independent audit -> bounded revision -> visual planning/generation -> visual audit。

Author uses fixed Source ID citation marker only。

Evidence/claim artifacts remain detailed job-private data until durable export transformation。

## Candidate preparation

Candidate build binds:

- source/evidence bundle hashes
- ArticleClaimRecord ledger hash
- **cleanup-safe CompactMaterialClaimBinding proposal hash**
- citations/examples/audits
- canonical source SHA/profile
- delivery variants/profile
- source/public persistence plans
- registry/provenance proposal

Before human review, deterministic validator must confirm every material claim can be transformed into public-safe durable support mapping without raw private source body。

## Media ingest / visual audit / variants

`media ingest`:

- HEIC/JPEG/PNG etc -> private canonical master
- orientation/sRGB/private metadata normalization
- no persistent remote storage

`visual-audit`:

- semantic visual/master audit
- reject visual gets no delivery variants

`media variants`:

- audited canonical master
- versioned profile
- deterministic AVIF/WebP/fallback
- no network/public upload

## Preview / approval

Preview uses local candidate media adapter。

Only human lane can create HumanApprovalRecord for exact candidate hash。

Persistent mutation before approval prohibited。

## Private canonical source storage

`article media source-store` legal only after `HUMAN_APPROVED`。

- exact approved canonical source verify
- content-addressed private source storage/reuse
- raw original is not stored
- CanonicalSourceStorageReceipt

Failure -> stay `HUMAN_APPROVED`。

## Public media publication

Legal only after `MEDIA_SOURCE_STORED`。

- exact approved public delivery set
- immutable content-addressed objects/cache metadata
- complete-set verification
- MediaPublicationManifest

Failure -> stay `MEDIA_SOURCE_STORED`。

## Protected media

Legal only after `MEDIA_PUBLISHED`。

- exact required public object set -> protected recovery plane
- validate full MediaProtectionReceipt

Failure -> stay `MEDIA_PUBLISHED`。

## Export

Legal only after `MEDIA_PROTECTED`。

Executor must revalidate:

- candidate/approval
- current claim/evidence/source artifacts
- approved cleanup-safe material claim proposal
- CanonicalSourceStorageReceipt set
- MediaPublicationManifest
- full MediaProtectionReceipt
- repository base

Then deterministically derive final Git Publication Provenance:

1. `CompactSourceRef[]`
2. `CompactMaterialClaimBinding[]`
3. canonical source identity/profile
4. AI/tool compact lineage
5. publication/protection hashes
6. `CompactMediaRecoveryBinding` from full valid MediaProtectionReceipt

Required checks:

- durable material claim ledger equals approved proposal semantics
- every durable sourceId resolves
- no private source body/path/credential in compact ledger
- media recovery object set exactly matches publication + full protection receipt
- protectedObjectRef is secret-free
- post-approval operational lineage does not change approved article/media bytes

Export:

- MDX/frontmatter
- Media Registry/canonical source identity
- Publication Provenance including materialClaims/mediaRecovery
- separately approved taxonomy/interactive changes

Media/raw/private job bytes are not exported to Git。

If derivation would require changing content/media/support, return approval stale rather than silently alter candidate。

## Cleanup

`site article cleanup` follows `article-job-retention-policy.md` / ADR-0024。

Required:

- state `EXPORTED`
- exact exported bytes at operator-selected durable Git ref
- durable material claim ledger valid
- source/public/protection chains valid
- mediaRecovery binding matches full receipt when media exists
- no unresolved external orphan tracking
- explicit confirm

Receipt hash alone is not sufficient if the full receipt is about to be deleted and required recovery binding is not durable。

Cleanup deletes exact job workspace only. It does not delete Git/R2 objects。

## Guide

Read-only output:

- state
- next legal operation
- missing permission/profile
- stale artifact
- side-effect class
- blockers

## Initial error classes

- `INVALID_JOB_SPEC`
- `CONTENT_ID_NOT_FOUND`
- `CONTENT_ID_AMBIGUOUS`
- `PERMISSION_DENIED`
- `SOURCE_PIN_FAILED`
- `REQUEST_FINGERPRINT_MISMATCH`
- `RESPONSE_SCHEMA_INVALID`
- `EVIDENCE_BINDING_INVALID`
- `DURABLE_CLAIM_BINDING_INVALID`
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
- `MEDIA_RECOVERY_BINDING_INVALID`
- `EXPORT_MISMATCH`
- `CLEANUP_NOT_ELIGIBLE`

Retry never weakens a gate。
