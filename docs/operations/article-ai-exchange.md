---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - Article Job AI prepare / run / import operations
---

# Article AI Exchange Operations

## Principle

Semantic AI = fixed request + exact Skill snapshot + response schema +, for external runs, exact disclosure admission manifest。

Canonical artifact/state/write、input disclosure authorization、example verification、media processing、source/public/protected storage、durable provenance export、cleanup are deterministic/external-operation responsibilities, not Skill authority。

## CLI target shape

```text
site article init
site article guide
site article source ...
site article disclosure inspect|authorize|derive|manifest
site article evidence prepare|run|import
site article author prepare|run|import
site article examples assess
site article audit prepare|run|import
site article revision prepare|run|import
site article visual-plan prepare|run|import
site article image prepare|generate|import
site article media ingest
site article visual-audit prepare|run|import
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

Exact command names become implementation machine SoT. Convenience runner never auto-confirms human approval/disclosure authorization/upload/admin privilege。

## Source pinning and disclosure records

Source acquisition is deterministic:

```text
candidate locator
 -> fetch/pin/hash
 -> SourceRecord
 -> ExternalAiDisclosureRecord
```

`publicSafe` / citation eligibility / trust class do not automatically choose external disclosure mode。

Initial behavior:

- public/repository source: versioned policy may admit exact representation after capability/secret checks
- user/private/local input: default deny until explicit authorization or admitted derived artifact
- hard-secret material: deny without ordinary override

`site article disclosure authorize` converts explicit human/repository policy intent into a typed authorization bound to exact materialized input identity; it is not an AI/Skill command and does not accept vague “all private data” grants as a hidden wildcard。

`site article disclosure derive` creates a local deterministic safe derivative for `allow_derived_only` policy。Raw source is not sent externally。

## External request preparation

Every external semantic/vision/image request goes through:

```text
fixed stage inputs
 -> exact physical request artifacts
 -> disclosure records
 -> ExternalAiDisclosureManifest
 -> final serialized request secret/private scan
 -> request hash
 -> provider run
```

Prepare/run rules:

1. determine actual outbound artifact set, including generated prompt/context artifacts;
2. require stage provider-use permission;
3. require a current disclosure record for each external input;
4. prove derived-only source contributes only the admitted derivative;
5. reject deny/unknown/stale/hard-secret input;
6. require manifest entries exactly equal actual provider input artifacts;
7. bind disclosure manifest SHA into `SemanticRequestEnvelope` / image request;
8. only then allow provider transport。

A provider adapter may not add hidden file/context/tool input after manifest compilation。

### Denied required evidence

If required evidence/context cannot be externally disclosed:

- use admitted derived artifact;
- use a configured local/non-external backend;
- request explicit authorization when appropriate;
- narrow/remove dependent claim;
- or return `BLOCKED` + limitation。

Do not silently omit required evidence and produce a result described as complete。

## Semantic stages

source discovery -> deterministic pinning/disclosure -> evidence -> author -> technical examples -> independent audit -> bounded revision -> visual planning/generation -> visual audit。

Author uses fixed Source ID citation markers only。Evidence/claim artifacts remain detailed job-private data until durable export transformation。

Each external stage uses a fresh request-level disclosure manifest even when the underlying source records are unchanged, because actual stage input artifact sets may differ。

## Candidate preparation

Candidate build binds:

- source/evidence bundle hashes
- ArticleClaimRecord ledger hash
- cleanup-safe `CompactMaterialClaimBinding` proposal hash
- citations/examples/audits
- canonical source SHA/profile
- delivery variants/profile
- source/public/protection persistence plans
- registry/provenance proposal

Before human review, validator confirms every material claim can be transformed into public-safe durable support mapping without raw private source body。

External-AI disclosure manifests are operational lineage, not article content. Their safe policy/manifest hashes may be carried into provenance, but private disclosure inventory/body is not a candidate article field。

## Media ingest / visual audit / variants

`media ingest`:

- HEIC/JPEG/PNG etc -> private canonical master
- orientation/sRGB/private metadata normalization
- no persistent remote storage

`visual-audit`:

- semantic visual/master audit
- reject visual gets no delivery variants
- external visual auditor receives only disclosure-admitted target image/article context

`media variants`:

- audited canonical master
- versioned profile
- deterministic AVIF/WebP/fallback
- no network/public upload

## Image generation

External image generation requires:

- `externalImageAI=true`
- fixed ImageGenerationRequest
- disclosure manifest for prompt/article context/reference image artifacts
- raw/private photo/screenshot is not admitted merely because image generation is enabled

Provider raw output is untrusted job-private bytes until normalization/audit/import succeeds。

## Preview / approval

Preview uses local candidate media adapter。

Only human lane can create HumanApprovalRecord for exact candidate hash。Persistent mutation before approval prohibited。

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

Legal only after `MEDIA_PROTECTED` and `repositoryExport=true`。

Executor revalidates:

- candidate/approval
- current claim/evidence/source artifacts
- approved cleanup-safe material claim proposal
- CanonicalSourceStorageReceipt set
- MediaPublicationManifest
- full MediaProtectionReceipt
- repository base
- external provider run/disclosure lineage for all external AI runs

Then derives final Git Publication Provenance:

1. `CompactSourceRef[]`
2. `CompactMaterialClaimBinding[]`
3. canonical source identity/profile
4. compact AI/tool lineage
5. safe disclosure policy/manifest hash lineage for external runs
6. publication/protection hashes
7. `CompactMediaRecoveryBinding` from full valid MediaProtectionReceipt

Required checks:

- durable material claim ledger equals approved proposal semantics
- every durable sourceId resolves
- no private source body/path/credential in compact ledger
- external run lineage has provider permission + request hash + disclosure manifest hash without exporting private disclosure body/path
- media recovery object set exactly matches publication + full protection receipt
- protectedObjectRef is secret-free
- post-approval operational lineage does not change approved article/media/support bytes

Export:

- MDX/frontmatter
- Media Registry/canonical source identity
- Publication Provenance including materialClaims/mediaRecovery/safe external-run lineage
- separately approved taxonomy/interactive changes

Media/raw/private job/disclosure artifacts are not exported to Git。

If derivation would require changing content/media/support, return approval stale rather than silently alter candidate。

## Cleanup

`site article cleanup` follows `article-job-retention-policy.md` / ADR-0024。

Required:

- state `EXPORTED`
- exact exported bytes at operator-selected durable Git ref
- durable material claim ledger valid
- safe required AI/disclosure lineage durable
- source/public/protection chains valid
- mediaRecovery binding matches full receipt when media exists
- no unresolved external orphan/incident tracking
- explicit confirm

Full private disclosure records/manifests may be deleted with job workspace after eligibility; their safe required hashes must already exist in durable provenance when an external run occurred。

Cleanup deletes exact job workspace only. It does not delete Git/R2 objects。

## Guide

Read-only output:

- state
- next legal operation
- missing permission/profile/disclosure authorization
- denied/derived-only input summary without exposing secrets
- stale artifact/manifest
- side-effect class
- blockers

## Initial error classes

- `INVALID_JOB_SPEC`
- `CONTENT_ID_NOT_FOUND`
- `CONTENT_ID_AMBIGUOUS`
- `PERMISSION_DENIED`
- `SOURCE_PIN_FAILED`
- `DISCLOSURE_DENIED`
- `DISCLOSURE_AUTHORIZATION_REQUIRED`
- `DISCLOSURE_RECORD_STALE`
- `DISCLOSURE_MANIFEST_MISMATCH`
- `SECRET_DISCLOSURE_BLOCKED`
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

Retry never weakens permission/disclosure/evidence/approval/recovery gates。
